// Linux Arsenal - terminal emulator UI
// A browser terminal with readline-style editing, history, tab completion, reverse search, ANSI colors
// and full-screen applications (nano, vim, less/man, top/htop, sl, cmatrix). It drives the simulated shell.
(function () {
    'use strict';
    const LA = (globalThis.LA = globalThis.LA || {});
    if (typeof document === 'undefined') return;
    const VFS = LA.VFS;

    // ------------------------------------------------------------------ ANSI rendering
    const ANSI_COLORS = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
    function newStyle() { return { fg: null, bg: null, bold: false, dim: false, italic: false, ul: false, inv: false }; }
    function applySgr(style, params) {
        if (!params.length) params = [0];
        for (let i = 0; i < params.length; i++) {
            const p = params[i];
            if (p === 0) Object.assign(style, newStyle());
            else if (p === 1) style.bold = true;
            else if (p === 2) style.dim = true;
            else if (p === 3) style.italic = true;
            else if (p === 4) style.ul = true;
            else if (p === 7) style.inv = true;
            else if (p === 22) { style.bold = false; style.dim = false; }
            else if (p === 23) style.italic = false;
            else if (p === 24) style.ul = false;
            else if (p === 27) style.inv = false;
            else if (p >= 30 && p <= 37) style.fg = 'c' + (p - 30);
            else if (p === 39) style.fg = null;
            else if (p >= 40 && p <= 47) style.bg = 'c' + (p - 40);
            else if (p === 49) style.bg = null;
            else if (p >= 90 && p <= 97) style.fg = 'c' + (p - 90 + 8);
            else if (p >= 100 && p <= 107) style.bg = 'c' + (p - 100 + 8);
            else if ((p === 38 || p === 48) && params[i + 1] === 5) {
                const n = params[i + 2];
                const key = p === 38 ? 'fg' : 'bg';
                style[key] = n < 16 ? 'c' + n : '#' + xterm256(n);
                i += 2;
            } else if ((p === 38 || p === 48) && params[i + 1] === 2) {
                const hex = '#' + [params[i + 2], params[i + 3], params[i + 4]].map((x) => (x | 0).toString(16).padStart(2, '0')).join('');
                style[p === 38 ? 'fg' : 'bg'] = hex;
                i += 4;
            }
        }
    }
    function xterm256(n) {
        if (n >= 232) { const v = 8 + (n - 232) * 10; return [v, v, v].map((x) => x.toString(16).padStart(2, '0')).join(''); }
        n -= 16;
        const r = Math.floor(n / 36), g = Math.floor((n % 36) / 6), b = n % 6;
        return [r, g, b].map((x) => (x ? 55 + x * 40 : 0).toString(16).padStart(2, '0')).join('');
    }
    function styleSpan(style, text) {
        const span = document.createElement('span');
        span.textContent = text;
        let fg = style.fg, bg = style.bg;
        if (style.inv) { const t = fg; fg = bg || 'bgdefault'; bg = t || 'fgdefault'; }
        const cls = [];
        if (fg) { if (fg[0] === '#') span.style.color = fg; else cls.push('ansi-fg-' + (style.bold && /^c[0-7]$/.test(fg) ? 'c' + (parseInt(fg.slice(1), 10) + 8) : fg)); }
        if (bg) { if (bg[0] === '#') span.style.backgroundColor = bg; else cls.push('ansi-bg-' + bg); }
        if (style.bold) cls.push('ansi-bold');
        if (style.dim) cls.push('ansi-dim');
        if (style.italic) cls.push('ansi-italic');
        if (style.ul) cls.push('ansi-ul');
        if (cls.length) span.className = cls.join(' ');
        return span;
    }
    function isPlain(style) { return !style.fg && !style.bg && !style.bold && !style.dim && !style.italic && !style.ul && !style.inv; }
    // Render a string with ANSI codes into a container (single "line" context); returns final style
    function renderAnsiInto(el, text, style) {
        style = style || newStyle();
        const re = /\x1b\[([0-9;?]*)([A-Za-z])|\x1b\][^\x07]*\x07/g;
        let last = 0, m;
        const flush = (s) => {
            if (!s) return;
            if (isPlain(style)) el.appendChild(document.createTextNode(s));
            else el.appendChild(styleSpan(style, s));
        };
        while ((m = re.exec(text)) !== null) {
            flush(text.slice(last, m.index));
            last = re.lastIndex;
            if (m[2] === 'm') applySgr(style, m[1] ? m[1].split(';').map((x) => parseInt(x || '0', 10)) : []);
        }
        flush(text.slice(last));
        return style;
    }
    LA.renderAnsiInto = renderAnsiInto;
    function stripAnsi(s) { return LA.util.stripAnsi(s); }
    function expandTabs(s) { let out = ''; for (const ch of s) { if (ch === '\t') out += ' '.repeat(8 - (out.length % 8)); else out += ch; } return out; }

    // ------------------------------------------------------------------ Terminal
    class Terminal {
        constructor(container, opts) {
            this.opts = opts || {};
            this.container = container;
            this.buffer = '';
            this.cursor = 0;
            this.history = [];
            this.histIndex = -1;
            this.histDraft = '';
            this.pending = '';
            this.killRing = '';
            this.search = null;
            this.app = null;
            this.pendingApps = [];
            this.lastTabAt = 0;
            this.style = newStyle();
            this.maxLines = this.opts.maxLines || 4000;
            this.busy = false;
            this.build();
            if (this.opts.shell) this.setShell(this.opts.shell, { banner: this.opts.banner });
        }

        build() {
            const c = this.container;
            c.classList.add('la-term');
            c.innerHTML = '';
            this.viewport = document.createElement('div');
            this.viewport.className = 'la-term-viewport';
            this.outputEl = document.createElement('div');
            this.outputEl.className = 'la-term-output';
            this.inputLine = document.createElement('div');
            this.inputLine.className = 'la-term-inputline';
            this.promptEl = document.createElement('span');
            this.promptEl.className = 'la-term-prompt';
            this.inputEl = document.createElement('span');
            this.inputEl.className = 'la-term-input';
            this.inputLine.appendChild(this.promptEl);
            this.inputLine.appendChild(this.inputEl);
            this.viewport.appendChild(this.outputEl);
            this.viewport.appendChild(this.inputLine);
            this.capture = document.createElement('textarea');
            this.capture.className = 'la-term-capture';
            this.capture.setAttribute('autocapitalize', 'off');
            this.capture.setAttribute('autocomplete', 'off');
            this.capture.setAttribute('autocorrect', 'off');
            this.capture.setAttribute('spellcheck', 'false');
            this.capture.setAttribute('aria-label', 'Terminal input');
            this.appEl = document.createElement('div');
            this.appEl.className = 'la-term-app hidden';
            this.appEl.setAttribute('role', 'application');
            this.measure = document.createElement('span');
            this.measure.className = 'la-term-measure';
            this.measure.textContent = 'MMMMMMMMMM';
            c.appendChild(this.viewport);
            c.appendChild(this.appEl);
            c.appendChild(this.capture);
            c.appendChild(this.measure);
            this.currentLine = null;

            this.capture.addEventListener('keydown', (e) => this.onKeyDown(e));
            this.capture.addEventListener('input', (e) => this.onInput(e));
            this.capture.addEventListener('compositionstart', () => { this.composing = true; });
            this.capture.addEventListener('compositionend', () => { this.composing = false; this.onInput(); });
            this.capture.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text');
                this.paste(text);
            });
            this.capture.addEventListener('focus', () => c.classList.add('focused'));
            this.capture.addEventListener('blur', () => c.classList.remove('focused'));
            c.addEventListener('mouseup', () => {
                const sel = window.getSelection && window.getSelection().toString();
                if (!sel) this.focus();
            });
            this.viewport.addEventListener('wheel', () => { this.userScrolled = true; }, { passive: true });
            this.appEl.addEventListener('wheel', (e) => { if (this.app && this.app.onWheel) { e.preventDefault(); this.app.onWheel(e.deltaY); } }, { passive: false });
            if (typeof ResizeObserver !== 'undefined') {
                this.ro = new ResizeObserver(() => this.fit());
                this.ro.observe(c);
            } else window.addEventListener('resize', () => this.fit());
            setTimeout(() => this.fit(), 0);
        }

        fit() {
            const r = this.measure.getBoundingClientRect();
            const cw = r.width / 10 || 8.4;
            const lh = r.height || 18;
            this.charWidth = cw;
            this.lineHeight = lh;
            const w = this.viewport.clientWidth - 4;
            const h = (this.app ? this.appEl.clientHeight : this.viewport.clientHeight) || 400;
            this.cols = Math.max(20, Math.floor(w / cw));
            this.rows = Math.max(8, Math.floor(h / lh));
            if (this.shell) { this.shell.columns = this.cols; this.shell.rows = this.rows; }
            if (this.app && this.app.render) this.app.render();
        }

        focus() { try { this.capture.focus({ preventScroll: true }); } catch (e) { this.capture.focus(); } }

        setShell(shell, opts) {
            opts = opts || {};
            this.shell = shell;
            shell.ui = {
                openEditor: (o) => this.pendingApps.push(() => this.openApp(new EditorApp(this, o))),
                openPager: (o) => this.pendingApps.push(() => this.openApp(new PagerApp(this, o))),
                openTop: (o) => this.pendingApps.push(() => this.openApp(new TopApp(this, o))),
                openAnimation: (k) => this.pendingApps.push(() => this.openApp(new AnimationApp(this, k)))
            };
            shell.columns = this.cols || 80;
            shell.rows = this.rows || 24;
            if (opts.history) this.history = opts.history;
            this.history = shell.history = opts.history || shell.history || [];
            this.histIndex = -1;
            if (opts.clear) this.clear();
            if (opts.banner) this.write(opts.banner);
            this.pending = '';
            this.buffer = '';
            this.cursor = 0;
            this.renderPrompt();
        }

        // ---------- output ----------
        newLine() {
            const line = document.createElement('div');
            line.className = 'la-term-line';
            this.outputEl.appendChild(line);
            this.currentLine = line;
            if (this.outputEl.childElementCount > this.maxLines) {
                const excess = this.outputEl.childElementCount - this.maxLines;
                for (let i = 0; i < excess; i++) this.outputEl.removeChild(this.outputEl.firstChild);
            }
            return line;
        }
        write(text) {
            if (text === undefined || text === null || text === '') return;
            text = String(text);
            // full clear sequences
            const clearIdx = Math.max(text.lastIndexOf('\x1b[2J'), text.lastIndexOf('\x1b[3J'));
            if (clearIdx !== -1) {
                this.clear();
                text = text.slice(clearIdx + 4).replace(/^\x1b\[3J|^\x1b\[H/g, '');
            }
            if (text.includes('\x07')) { this.bell(); text = text.replace(/\x07/g, ''); }
            text = text.replace(/\r\n/g, '\n');
            const parts = text.split('\n');
            parts.forEach((part, i) => {
                if (i > 0 || !this.currentLine) this.newLine();
                if (part.includes('\r')) {
                    // carriage return: overwrite the current line
                    const segs = part.split('\r');
                    part = segs[segs.length - 1] || segs[segs.length - 2] || '';
                    this.currentLine.textContent = '';
                }
                if (part) this.style = renderAnsiInto(this.currentLine, expandTabs(part), this.style);
            });
            if (text.endsWith('\n')) this.currentLine = null;
            this.scrollToBottom();
        }
        writeln(text) { this.write((text || '') + '\n'); }
        clear() {
            this.outputEl.innerHTML = '';
            this.currentLine = null;
        }
        bell() {
            this.container.classList.add('la-term-bell');
            setTimeout(() => this.container.classList.remove('la-term-bell'), 150);
        }
        scrollToBottom() {
            this.viewport.scrollTop = this.viewport.scrollHeight;
        }

        // ---------- prompt / input rendering ----------
        promptText() {
            if (this.search) return '(reverse-i-search)`' + this.search.query + "': ";
            if (this.pending) return this.shell.promptString('PS2');
            return this.shell.promptString('PS1');
        }
        renderPrompt() {
            if (!this.shell) return;
            this.promptEl.innerHTML = '';
            renderAnsiInto(this.promptEl, this.promptText());
            this.renderInput();
            if (this.opts.onPrompt) this.opts.onPrompt(this);
        }
        renderInput() {
            const el = this.inputEl;
            el.innerHTML = '';
            let text = this.buffer, cur = this.cursor;
            if (this.search) { text = this.search.match || ''; cur = this.search.matchPos >= 0 ? this.search.matchPos : text.length; }
            const before = document.createTextNode(text.slice(0, cur));
            const cursor = document.createElement('span');
            cursor.className = 'la-term-cursor';
            cursor.textContent = text[cur] || ' ';
            const after = document.createTextNode(text.slice(cur + 1));
            el.appendChild(before);
            el.appendChild(cursor);
            el.appendChild(after);
            // keep the IME/caret helper next to the cursor
            this.scrollToBottom();
        }
        echoInputLine(extra) {
            // freeze the current prompt + input as an output line
            const line = this.newLine();
            renderAnsiInto(line, this.promptText());
            line.appendChild(document.createTextNode(this.buffer + (extra || '')));
            this.currentLine = null;
        }

        // ---------- keyboard ----------
        onInput() {
            if (this.composing) return;
            const v = this.capture.value;
            if (!v) return;
            this.capture.value = '';
            if (this.app) { for (const ch of v) this.app.onKey({ key: ch, char: ch }); return; }
            if (v.includes('\n')) { this.paste(v); return; }
            this.insert(v);
        }
        insert(text) {
            if (this.search) { this.search.query += text; this.doSearch(false); return; }
            this.buffer = this.buffer.slice(0, this.cursor) + text + this.buffer.slice(this.cursor);
            this.cursor += text.length;
            this.renderInput();
        }
        paste(text) {
            text = text.replace(/\r\n?/g, '\n');
            if (this.app) { for (const ch of text) this.app.onKey({ key: ch === '\n' ? 'Enter' : ch, char: ch === '\n' ? null : ch }); return; }
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (i < lines.length - 1) { this.insert(lines[i]); this.submit(); if (this.app) { this.pastedRest = lines.slice(i + 1).join('\n'); return; } }
                else this.insert(lines[i]);
            }
        }
        onKeyDown(e) {
            if (this.app) {
                const k = this.keyName(e);
                if (k === null) return;
                if (k === 'ctrl+shift+c' || k === 'ctrl+shift+v') return;
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) return; // handled by input event
                e.preventDefault();
                this.app.onKey({ key: k, char: null, event: e });
                return;
            }
            const k = this.keyName(e);
            if (k === null) return;
            if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) return; // printable -> input event
            if (k === 'ctrl+c' && window.getSelection && window.getSelection().toString()) return; // copy selection
            if (k === 'ctrl+shift+c' || k === 'ctrl+v' || k === 'ctrl+shift+v' || k === 'meta+c' || k === 'meta+v') return;
            const handled = this.handleKey(k, e);
            if (handled !== false) e.preventDefault();
        }
        keyName(e) {
            let k = e.key;
            if (k === 'Dead' || k === 'Process' || k === 'Unidentified') return null;
            if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta' || k === 'CapsLock') return null;
            if (k.length === 1) k = k.toLowerCase();
            let name = '';
            if (e.ctrlKey) name += 'ctrl+';
            if (e.altKey) name += 'alt+';
            if (e.metaKey) name += 'meta+';
            if (e.shiftKey && (k.length > 1 || e.ctrlKey)) name += 'shift+';
            return name + k;
        }
        handleKey(k) {
            if (this.search) return this.handleSearchKey(k);
            const b = this.buffer;
            const wordLeft = (pos) => { let p = pos; while (p > 0 && /\s|[\/._-]/.test(b[p - 1])) p--; while (p > 0 && !/\s|[\/._-]/.test(b[p - 1])) p--; return p; };
            const wordRight = (pos) => { let p = pos; while (p < b.length && /\s|[\/._-]/.test(b[p])) p++; while (p < b.length && !/\s|[\/._-]/.test(b[p])) p++; return p; };
            switch (k) {
                case 'Enter': case 'ctrl+m': case 'ctrl+j': this.submit(); return;
                case 'Backspace': case 'ctrl+h':
                    if (this.cursor > 0) { this.buffer = b.slice(0, this.cursor - 1) + b.slice(this.cursor); this.cursor--; this.renderInput(); }
                    else this.bell();
                    return;
                case 'Delete':
                    if (this.cursor < b.length) { this.buffer = b.slice(0, this.cursor) + b.slice(this.cursor + 1); this.renderInput(); }
                    return;
                case 'ctrl+d':
                    if (b.length) { if (this.cursor < b.length) { this.buffer = b.slice(0, this.cursor) + b.slice(this.cursor + 1); this.renderInput(); } return; }
                    this.buffer = 'exit'; this.cursor = 4; this.submit(); return;
                case 'ArrowLeft': case 'ctrl+b': if (this.cursor > 0) this.cursor--; this.renderInput(); return;
                case 'ArrowRight': case 'ctrl+f': if (this.cursor < b.length) this.cursor++; this.renderInput(); return;
                case 'Home': case 'ctrl+a': this.cursor = 0; this.renderInput(); return;
                case 'End': case 'ctrl+e': this.cursor = b.length; this.renderInput(); return;
                case 'alt+b': case 'ctrl+ArrowLeft': this.cursor = wordLeft(this.cursor); this.renderInput(); return;
                case 'alt+f': case 'ctrl+ArrowRight': this.cursor = wordRight(this.cursor); this.renderInput(); return;
                case 'ctrl+u': this.killRing = b.slice(0, this.cursor); this.buffer = b.slice(this.cursor); this.cursor = 0; this.renderInput(); return;
                case 'ctrl+k': this.killRing = b.slice(this.cursor); this.buffer = b.slice(0, this.cursor); this.renderInput(); return;
                case 'ctrl+w': case 'alt+Backspace': case 'ctrl+Backspace': {
                    let p = this.cursor;
                    while (p > 0 && b[p - 1] === ' ') p--;
                    while (p > 0 && b[p - 1] !== ' ') p--;
                    this.killRing = b.slice(p, this.cursor);
                    this.buffer = b.slice(0, p) + b.slice(this.cursor);
                    this.cursor = p;
                    this.renderInput();
                    return;
                }
                case 'alt+d': { const e2 = wordRight(this.cursor); this.killRing = b.slice(this.cursor, e2); this.buffer = b.slice(0, this.cursor) + b.slice(e2); this.renderInput(); return; }
                case 'ctrl+y': this.insert(this.killRing); return;
                case 'ctrl+t':
                    if (this.cursor > 0 && b.length > 1) {
                        const p = this.cursor === b.length ? this.cursor - 1 : this.cursor;
                        this.buffer = b.slice(0, p - 1) + b[p] + b[p - 1] + b.slice(p + 1);
                        this.cursor = Math.min(b.length, p + 1);
                        this.renderInput();
                    }
                    return;
                case 'alt+u': { const e2 = wordRight(this.cursor); this.buffer = b.slice(0, this.cursor) + b.slice(this.cursor, e2).toUpperCase() + b.slice(e2); this.cursor = e2; this.renderInput(); return; }
                case 'alt+l': { const e2 = wordRight(this.cursor); this.buffer = b.slice(0, this.cursor) + b.slice(this.cursor, e2).toLowerCase() + b.slice(e2); this.cursor = e2; this.renderInput(); return; }
                case 'alt+.': case 'alt+_': {
                    const last = this.history[this.history.length - 1];
                    if (last) { const w = last.trim().split(/\s+/); this.insert(w[w.length - 1]); }
                    return;
                }
                case 'ctrl+l': this.clear(); this.renderPrompt(); return;
                case 'ctrl+c':
                    this.echoInputLine('^C');
                    this.buffer = ''; this.cursor = 0; this.pending = ''; this.histIndex = -1;
                    if (this.shell) this.shell.lastStatus = 130;
                    this.renderPrompt();
                    return;
                case 'ctrl+z': this.echoInputLine('^Z'); this.buffer = ''; this.cursor = 0; this.renderPrompt(); return;
                case 'ArrowUp': case 'ctrl+p': this.historyMove(-1); return;
                case 'ArrowDown': case 'ctrl+n': this.historyMove(1); return;
                case 'alt+<': this.historyGoto(0); return;
                case 'alt+>': this.historyGoto(this.history.length); return;
                case 'ctrl+r': this.search = { query: '', match: '', index: this.history.length, matchPos: -1, saved: this.buffer }; this.renderPrompt(); return;
                case 'Tab': this.complete(); return;
                case 'shift+Tab': return;
                case 'PageUp': case 'shift+PageUp': this.viewport.scrollTop -= this.viewport.clientHeight * 0.9; return;
                case 'PageDown': case 'shift+PageDown': this.viewport.scrollTop += this.viewport.clientHeight * 0.9; return;
                case 'Escape': return;
                case 'Insert': return;
            }
            return false;
        }
        handleSearchKey(k) {
            const s = this.search;
            switch (k) {
                case 'ctrl+r': this.doSearch(true); return;
                case 'Backspace': s.query = s.query.slice(0, -1); s.index = this.history.length; this.doSearch(false); return;
                case 'Enter': this.buffer = s.match || s.query && s.match || this.buffer; this.cursor = this.buffer.length; this.search = null; this.submit(); return;
                case 'ctrl+g': case 'ctrl+c': this.buffer = s.saved; this.cursor = this.buffer.length; this.search = null; this.renderPrompt(); return;
                case 'Escape': case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': case 'Home': case 'End': case 'ctrl+a': case 'ctrl+e': case 'Tab':
                    this.buffer = s.match || s.saved; this.cursor = k === 'Home' || k === 'ctrl+a' ? 0 : this.buffer.length; this.search = null; this.renderPrompt(); return;
            }
            return false;
        }
        doSearch(older) {
            const s = this.search;
            let start = older ? s.index - 1 : Math.min(s.index, this.history.length - 1);
            if (!s.query) { s.match = ''; s.matchPos = -1; this.renderPrompt(); return; }
            for (let i = start; i >= 0; i--) {
                const pos = this.history[i].lastIndexOf(s.query);
                if (pos !== -1) { s.index = i; s.match = this.history[i]; s.matchPos = pos; this.renderPrompt(); return; }
            }
            this.bell();
            this.renderPrompt();
        }
        historyMove(dir) {
            if (!this.history.length) return;
            if (this.histIndex === -1) { if (dir > 0) return; this.histDraft = this.buffer; this.histIndex = this.history.length; }
            let idx = this.histIndex + dir;
            if (idx < 0) { this.bell(); idx = 0; }
            if (idx >= this.history.length) { this.histIndex = -1; this.buffer = this.histDraft; }
            else { this.histIndex = idx; this.buffer = this.history[idx]; }
            this.cursor = this.buffer.length;
            this.renderInput();
        }
        historyGoto(idx) {
            if (idx >= this.history.length) { this.histIndex = -1; this.buffer = this.histDraft || ''; }
            else { if (this.histIndex === -1) this.histDraft = this.buffer; this.histIndex = idx; this.buffer = this.history[idx]; }
            this.cursor = this.buffer.length;
            this.renderInput();
        }

        // ---------- completion ----------
        completionCandidates(before) {
            const sh = this.shell;
            const info = LA.shellUtil.splitForCompletion(before);
            const word = info.current;
            const words = info.words;
            const first = words[0];
            let cands = [];
            let isPath = false;
            if (word.startsWith('$')) {
                const pre = word.slice(1).replace(/^\{/, '');
                cands = Array.from(sh.vars.keys()).filter((k) => k.startsWith(pre)).map((k) => '$' + (word[1] === '{' ? '{' + k + '}' : k));
            } else if (info.currentIsCmd && !word.includes('/') && !(first && ['sudo', 'man', 'which', 'type', 'tldr', 'whatis', 'time', 'watch', 'nohup', 'xargs'].includes(first) === false && false)) {
                cands = this.commandNames().filter((n) => n.startsWith(word));
            } else if (first && ((first === 'sudo' && words.length === 1) || (['man', 'which', 'type', 'tldr', 'whatis', 'whereis', 'help', 'examples', 'info', 'command'].includes(first) && words.length === 1)) && !word.includes('/')) {
                cands = this.commandNames().filter((n) => n.startsWith(word));
            } else {
                const sub = this.subcommandCandidates(words, word);
                if (sub) cands = sub;
                else { cands = this.pathCandidates(word, first === 'cd' || first === 'pushd' || first === 'rmdir'); isPath = true; }
            }
            return { cands: Array.from(new Set(cands)).sort(), word, start: before.length - word.length - (info.inQuote ? 1 : 0), isPath, inQuote: info.inQuote };
        }
        commandNames() {
            const sh = this.shell;
            const set = new Set(Object.keys(sh.aliases).concat(Object.keys(sh.functions)));
            for (const [k, v] of Object.entries(sh.commands)) if (v.builtin && !v.hidden) set.add(k);
            for (const dir of (sh.getVar('PATH') || '').split(':')) {
                if (!dir) continue;
                try {
                    const p = VFS.normalize(dir, sh.cwd, sh.home);
                    for (const n of sh.fs.list(p)) { const node = sh.fs.get(p + '/' + n); if (node && node.type === 'file' && (node.mode & 0o111)) set.add(n); }
                } catch (e) { /* skip */ }
            }
            for (const k of ['if', 'then', 'else', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function']) set.add(k);
            return Array.from(set);
        }
        subcommandCandidates(words, word) {
            const SUBS = {
                git: ['add', 'branch', 'checkout', 'clone', 'commit', 'config', 'diff', 'fetch', 'init', 'log', 'merge', 'mv', 'pull', 'push', 'remote', 'reset', 'restore', 'revert', 'rm', 'show', 'stash', 'status', 'switch', 'tag', 'blame', 'clean', 'cherry-pick', 'reflog', 'rev-parse', 'ls-files', 'shortlog'],
                docker: ['build', 'exec', 'images', 'info', 'inspect', 'kill', 'logs', 'network', 'ps', 'pull', 'rename', 'restart', 'rm', 'rmi', 'run', 'start', 'stats', 'stop', 'system', 'tag', 'version', 'volume', 'container', 'image'],
                systemctl: ['status', 'start', 'stop', 'restart', 'reload', 'enable', 'disable', 'is-active', 'is-enabled', 'is-failed', 'list-units', 'list-unit-files', 'list-timers', 'daemon-reload', 'show', 'cat'],
                apt: ['update', 'upgrade', 'install', 'remove', 'purge', 'search', 'show', 'list', 'autoremove', 'policy'],
                'apt-get': ['update', 'upgrade', 'install', 'remove', 'purge', 'autoremove'],
                ip: ['addr', 'link', 'route', 'neigh'],
                ufw: ['status', 'enable', 'disable', 'allow', 'deny', 'delete', 'reset', 'reload'],
                challenge: ['list', 'start', 'random', 'hint', 'solution', 'check', 'reset', 'quit', 'info', 'next'],
                tutorial: ['start', 'next', 'skip', 'status', 'quit', 'reset'],
                service: ['--status-all']
            };
            let w = words.slice();
            if (w[0] === 'sudo') w = w.slice(1);
            const cmd = w[0];
            if (!cmd) return null;
            if (w.length === 1 && SUBS[cmd]) return SUBS[cmd].filter((s) => s.startsWith(word));
            const sh = this.shell;
            if (cmd === 'systemctl' || cmd === 'service') {
                if (w.length >= (cmd === 'service' ? 1 : 2)) return Object.keys(sh.system.services).filter((s) => s.startsWith(word)).concat((cmd === 'service' && w.length === 2) ? ['start', 'stop', 'restart', 'status'].filter((s) => s.startsWith(word)) : []);
            }
            if (cmd === 'apt' || cmd === 'apt-get') { if (['install', 'show', 'remove', 'purge'].includes(w[1])) return Object.keys(LA.PACKAGES).filter((p) => p.startsWith(word)); }
            if (cmd === 'git' && ['checkout', 'switch', 'merge', 'branch', 'rebase'].includes(w[1])) {
                try {
                    let dir = sh.cwd;
                    for (;;) { if (sh.fs.isFile(dir + '/.git/la-state.json')) break; if (dir === '/') return null; dir = VFS.dirname(dir); }
                    const st = JSON.parse(sh.fs.readFile(dir + '/.git/la-state.json'));
                    return Object.keys(st.branches).filter((b) => b.startsWith(word));
                } catch (e) { return null; }
            }
            if (cmd === 'docker' && ['stop', 'start', 'rm', 'logs', 'exec', 'restart', 'inspect', 'kill'].includes(w[1]) && sh.system.docker) return sh.system.docker.containers.map((c) => c.name).filter((n) => n.startsWith(word));
            if ((cmd === 'kill' || cmd === 'renice') && /^\d*$/.test(word)) return sh.system.processes.map((p) => String(p.pid)).filter((p) => p.startsWith(word));
            if ((cmd === 'killall' || cmd === 'pkill' || cmd === 'pgrep' || cmd === 'pidof')) return Array.from(new Set(sh.system.processes.map((p) => LA.procComm ? LA.procComm(p.cmd) : p.cmd))).filter((p) => p.startsWith(word));
            if (['su', 'passwd', 'userdel', 'usermod', 'id', 'groups', 'finger'].includes(cmd)) return sh.system.users.map((u) => u.name).filter((n) => n.startsWith(word));
            if (cmd === 'man' || cmd === 'tldr' || cmd === 'examples') return null;
            if (cmd === 'challenge' && w[1] === 'start') return null;
            return null;
        }
        pathCandidates(word, dirsOnly) {
            const sh = this.shell;
            let unq = word.replace(/\\(.)/g, '$1');
            let dirPart = '', base = unq;
            const slash = unq.lastIndexOf('/');
            if (slash !== -1) { dirPart = unq.slice(0, slash + 1); base = unq.slice(slash + 1); }
            let dirAbs;
            if (dirPart === '') dirAbs = sh.cwd;
            else if (dirPart.startsWith('~')) dirAbs = VFS.normalize(dirPart.replace(/^~/, sh.home), sh.cwd, sh.home);
            else dirAbs = VFS.normalize(dirPart, sh.cwd, sh.home);
            let names;
            try { names = sh.fs.list(dirAbs); } catch (e) { return []; }
            const out = [];
            for (const n of names) {
                if (!n.startsWith(base)) continue;
                if (n.startsWith('.') && !base.startsWith('.')) continue;
                let node;
                try { node = sh.fs.get(dirAbs + '/' + n); } catch (e) { node = null; }
                const isDir = node && node.type === 'dir';
                if (dirsOnly && !isDir) continue;
                out.push(dirPart + n + (isDir ? '/' : ''));
            }
            return out;
        }
        complete() {
            const before = this.buffer.slice(0, this.cursor);
            const after = this.buffer.slice(this.cursor);
            const { cands, word, isPath, inQuote } = this.completionCandidates(before);
            const esc = (s) => (inQuote ? s : s.replace(/([ '"()&;|<>$`\\!*?[\]{}])/g, '\\$1'));
            const replaceWord = (replacement, finished) => {
                const start = before.length - word.length - (inQuote ? 0 : 0);
                let suffix = '';
                if (finished && !replacement.endsWith('/')) suffix = inQuote ? inQuote + ' ' : ' ';
                // find where the raw word starts in the buffer
                const rawStart = this.rawWordStart(before);
                this.buffer = before.slice(0, rawStart) + (inQuote ? inQuote : '') + (inQuote ? replacement : esc(replacement)) + suffix + after;
                this.cursor = this.buffer.length - after.length;
                void start;
                this.renderInput();
            };
            if (!cands.length) { this.bell(); return; }
            if (cands.length === 1) { replaceWord(cands[0], true); return; }
            // common prefix
            let prefix = cands[0];
            for (const cnd of cands) { let i = 0; while (i < prefix.length && i < cnd.length && prefix[i] === cnd[i]) i++; prefix = prefix.slice(0, i); }
            if (prefix.length > word.replace(/\\(.)/g, '$1').length) { replaceWord(prefix, false); return; }
            const now = Date.now();
            if (now - this.lastTabAt < 700 || cands.length <= 1) {
                this.echoInputLine('');
                const display = cands.map((cnd) => (isPath ? cnd.slice(cnd.lastIndexOf('/', cnd.length - 2) + 1) : cnd));
                if (display.length > 200) this.writeln('Display all ' + display.length + ' possibilities? (showing first 200)');
                this.write(LA.util.columnize(display.slice(0, 200), this.cols || 80));
                this.renderPrompt();
            } else this.bell();
            this.lastTabAt = now;
        }
        rawWordStart(before) {
            let q = null, start = 0;
            for (let i = 0; i < before.length; i++) {
                const c = before[i];
                if (q) { if (c === q) q = null; continue; }
                if (c === '\\') { i++; continue; }
                if (c === "'" || c === '"') { q = c; if (i === start) continue; continue; }
                if (c === ' ' || c === '\t' || '|;&('.includes(c)) start = i + 1;
            }
            return start;
        }

        // ---------- execution ----------
        submit() {
            const line = this.buffer;
            this.echoInputLine('');
            this.buffer = '';
            this.cursor = 0;
            this.histIndex = -1;
            const full = this.pending ? this.pending + '\n' + line : line;
            if (this.shell.isIncomplete(full)) {
                this.pending = full;
                this.renderPrompt();
                return;
            }
            this.pending = '';
            this.execute(full);
        }
        execute(src, opts) {
            opts = opts || {};
            const sh = this.shell;
            let line = src;
            if (!line.trim()) { this.renderPrompt(); return; }
            // history expansion
            if (!opts.noHistory) {
                try {
                    const h = sh.expandHistory(line);
                    if (h.changed) { line = h.line; this.writeln(line); }
                } catch (e) {
                    this.writeln('bash: ' + e.message);
                    this.renderPrompt();
                    return;
                }
                if (!/^\s/.test(line) && line !== this.history[this.history.length - 1]) this.history.push(line);
                if (this.history.length > 1000) this.history.splice(0, this.history.length - 1000);
            }
            // application hooks (e.g. challenge / tutorial) may intercept
            if (this.opts.beforeCommand && this.opts.beforeCommand(line, this) === false) { this.renderPrompt(); return; }
            let stdout = '';
            const cwdBefore = sh.cwd;
            const outW = new LA.FnWriter((s) => { stdout += s; this.write(s); });
            const errW = new LA.FnWriter((s) => this.write(s));
            const t0 = performance.now();
            let code;
            try { code = sh.run(line, { stdout: outW, stderr: errW, tty: true }); }
            catch (e) { this.writeln('bash: internal error: ' + e.message); code = 1; console.error(e); }
            const ms = performance.now() - t0;
            if (this.currentLine && this.currentLine.textContent !== '' ) { /* output without trailing newline: keep prompt on next line like zsh? bash keeps it inline */ this.currentLine = null; }
            const info = { line, stdout, code, cwdBefore, execLog: sh.execLog.slice(), ms };
            const exited = sh.exitRequested;
            sh.exitRequested = false;
            if (this.opts.onCommand) this.opts.onCommand(line, info, this);
            if (exited && this.opts.onExit) this.opts.onExit(this);
            if (this.pendingApps.length) { const open = this.pendingApps.shift(); this.pendingApps = []; open(); return; }
            this.renderPrompt();
        }
        run(cmd) { this.buffer = cmd; this.cursor = cmd.length; this.submit(); }

        // ---------- full screen apps ----------
        openApp(app) {
            this.app = app;
            this.container.classList.add('la-term-app-open');
            this.appEl.classList.remove('hidden');
            this.fit();
            app.render();
            this.focus();
        }
        closeApp(message) {
            if (this.app && this.app.destroy) this.app.destroy();
            this.app = null;
            this.appEl.classList.add('hidden');
            this.appEl.innerHTML = '';
            this.container.classList.remove('la-term-app-open');
            if (message) this.writeln(message);
            if (this.opts.onAppClose) this.opts.onAppClose(this);
            this.renderPrompt();
            this.focus();
            if (this.pastedRest) { const r = this.pastedRest; this.pastedRest = null; this.paste(r); }
        }
        renderRows(rows) {
            // rows: array of strings (may contain ANSI). Pads to terminal height.
            const frag = document.createDocumentFragment();
            for (const r of rows) {
                const div = document.createElement('div');
                div.className = 'la-term-approw';
                renderAnsiInto(div, r === '' ? ' ' : r);
                frag.appendChild(div);
            }
            this.appEl.innerHTML = '';
            this.appEl.appendChild(frag);
        }
        destroy() {
            if (this.ro) this.ro.disconnect();
            if (this.app && this.app.destroy) this.app.destroy();
        }
    }

    const INV = '\x1b[7m', RST = '\x1b[0m';
    function padVisible(s, w) { const len = stripAnsi(s).length; return len >= w ? s : s + ' '.repeat(w - len); }
    function truncVisible(s, w) {
        // truncate a string with ANSI codes to w visible chars
        let out = '', vis = 0;
        const re = /\x1b\[[0-9;?]*[A-Za-z]/g;
        let last = 0, m;
        while ((m = re.exec(s)) !== null) {
            const chunk = s.slice(last, m.index);
            if (vis + chunk.length > w) { out += chunk.slice(0, w - vis); return out + RST; }
            out += chunk; vis += chunk.length; out += m[0]; last = re.lastIndex;
        }
        const chunk = s.slice(last);
        out += chunk.slice(0, Math.max(0, w - vis));
        return out;
    }

    // ------------------------------------------------------------------ Pager (less / more / man)
    class PagerApp {
        constructor(term, o) {
            this.t = term;
            this.title = o.title || '';
            this.man = !!o.man;
            const text = o.text.endsWith('\n') ? o.text.slice(0, -1) : o.text;
            this.lines = text.split('\n').map((l) => expandTabs(l));
            if (o.numbers) this.lines = this.lines.map((l, i) => String(i + 1).padStart(7) + ' ' + l);
            this.top = 0;
            this.prompt = null;
            this.msg = '';
            this.lastSearch = null;
        }
        get pageSize() { return Math.max(1, this.t.rows - 1); }
        maxTop() { return Math.max(0, this.lines.length - this.pageSize); }
        render() {
            const rows = [];
            const w = this.t.cols;
            for (let i = 0; i < this.pageSize; i++) {
                const idx = this.top + i;
                let l = idx < this.lines.length ? this.lines[idx] : '~';
                if (this.lastSearch && idx < this.lines.length) {
                    try {
                        const re = new RegExp('(' + this.lastSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
                        const plain = stripAnsi(l);
                        if (re.test(plain)) l = plain.replace(re, INV + '$1' + RST);
                    } catch (e) { /* ignore */ }
                }
                rows.push(truncVisible(l, w));
            }
            let status;
            if (this.prompt !== null) status = this.prompt.label + this.prompt.value + '\u2588';
            else if (this.msg) status = INV + this.msg + RST;
            else if (this.man) status = INV + ' ' + this.title + ' line ' + (this.top + 1) + (this.top >= this.maxTop() ? ' (END)' : '') + ' (press h for help or q to quit)' + RST;
            else status = this.top >= this.maxTop() ? INV + '(END)' + RST : (this.top === 0 && this.title ? INV + this.title + RST : ':');
            rows.push(status);
            this.t.renderRows(rows);
        }
        scroll(n) { this.top = Math.max(0, Math.min(this.maxTop(), this.top + n)); this.render(); }
        onWheel(dy) { this.scroll(dy > 0 ? 3 : -3); }
        find(dir) {
            if (!this.lastSearch) return;
            const needle = this.lastSearch.toLowerCase();
            for (let i = this.top + dir; i >= 0 && i < this.lines.length; i += dir) {
                if (stripAnsi(this.lines[i]).toLowerCase().includes(needle)) { this.top = Math.min(i, this.maxTop()); this.msg = ''; this.render(); return; }
            }
            this.msg = 'Pattern not found  (press RETURN)';
            this.render();
        }
        onKey(ev) {
            const k = ev.char || ev.key;
            if (this.prompt !== null) {
                if (ev.key === 'Enter') { this.lastSearch = this.prompt.value || this.lastSearch; this.prompt = null; this.find(1); return; }
                if (ev.key === 'Escape' || ev.key === 'ctrl+c') { this.prompt = null; this.render(); return; }
                if (ev.key === 'Backspace') { if (!this.prompt.value) { this.prompt = null; } else this.prompt.value = this.prompt.value.slice(0, -1); this.render(); return; }
                if (ev.char) { this.prompt.value += ev.char; this.render(); }
                return;
            }
            if (this.msg) { this.msg = ''; }
            if (this.help) { this.help = false; this.lines = this.savedLines; this.top = this.savedTop; this.render(); if (k === 'q') return; }
            switch (k) {
                case 'q': case 'Q': case 'ctrl+c': case 'Escape': this.t.closeApp(); return;
                case 'j': case 'ArrowDown': case 'Enter': case 'e': case 'ctrl+n': this.scroll(1); return;
                case 'k': case 'ArrowUp': case 'y': case 'ctrl+p': this.scroll(-1); return;
                case ' ': case 'f': case 'PageDown': case 'ctrl+f': case 'ctrl+v': this.scroll(this.pageSize); return;
                case 'b': case 'PageUp': case 'ctrl+b': case 'alt+v': this.scroll(-this.pageSize); return;
                case 'd': case 'ctrl+d': this.scroll(Math.floor(this.pageSize / 2)); return;
                case 'u': case 'ctrl+u': this.scroll(-Math.floor(this.pageSize / 2)); return;
                case 'g': case 'Home': case '<': this.top = 0; this.render(); return;
                case 'G': case 'End': case '>': this.top = this.maxTop(); this.render(); return;
                case '/': this.prompt = { label: '/', value: '' }; this.render(); return;
                case 'n': this.find(1); return;
                case 'N': this.find(-1); return;
                case 'h': case 'H':
                    this.help = true; this.savedLines = this.lines; this.savedTop = this.top;
                    this.lines = ['                   SUMMARY OF LESS COMMANDS', '', '  q  Q  :q            Exit.', '  j  e  ^N  DOWN      Forward  one line.', '  k  y  ^P  UP        Backward one line.', '  SPACE  f  PgDn      Forward  one window.', '  b  PgUp            Backward one window.', '  d  u                Forward / backward half a window.', '  g  <  HOME          Go to first line.', '  G  >  END           Go to last line.', '  /pattern            Search forward for pattern.', '  n  N                Repeat previous search (reverse).', '', '  (press any key to return)'];
                    this.top = 0; this.render(); return;
            }
            this.render();
        }
    }

    // ------------------------------------------------------------------ Editor (nano + vim)
    class EditorApp {
        constructor(term, o) {
            this.t = term;
            this.o = o;
            this.mode = o.mode === 'vim' ? 'vim' : 'nano';
            this.path = o.path;
            this.name = o.displayName || (o.path ? VFS.basename(o.path) : '');
            const content = o.content || '';
            this.lines = content.split('\n');
            if (this.lines.length > 1 && this.lines[this.lines.length - 1] === '') this.lines.pop();
            this.cy = 0; this.cx = 0; this.top = 0; this.left = 0;
            this.modified = false;
            this.readonly = !!o.readonly;
            this.vimMode = 'normal';
            this.cmdline = null;
            this.prompt = null;
            this.message = '';
            this.undo = [];
            this.redo = [];
            this.cutBuffer = [];
            this.lastWasCut = false;
            this.yank = null;
            this.count = '';
            this.pendingOp = '';
            this.lineNumbers = false;
            this.lastSearch = null;
            if (this.mode === 'vim') this.message = o.isNew ? '"' + (this.name || '[No Name]') + '" [New]' : '"' + this.name + '" ' + this.lines.length + 'L, ' + VFS.utf8Length(content) + 'B' + (this.readonly ? ' [readonly]' : '');
            else if (o.isNew && this.name) this.message = '[ New File ]';
            else if (this.readonly) this.message = '[ File \'' + this.name + '\' is unwritable ]';
            else this.message = '[ Read ' + this.lines.length + ' line' + (this.lines.length === 1 ? '' : 's') + ' ]';
        }
        snapshot() { this.undo.push({ lines: this.lines.slice(), cy: this.cy, cx: this.cx }); if (this.undo.length > 200) this.undo.shift(); this.redo = []; }
        restore(stack, other) {
            const s = stack.pop();
            if (!s) { this.message = this.mode === 'vim' ? 'Already at oldest change' : '[ Nothing to undo ]'; return; }
            other.push({ lines: this.lines.slice(), cy: this.cy, cx: this.cx });
            this.lines = s.lines; this.cy = s.cy; this.cx = s.cx; this.modified = true;
        }
        get textRows() { return Math.max(3, this.t.rows - (this.mode === 'nano' ? 4 : 2)); }
        clampCursor(insertish) {
            this.cy = Math.max(0, Math.min(this.lines.length - 1, this.cy));
            const len = this.lines[this.cy].length;
            const max = this.mode === 'vim' && this.vimMode === 'normal' && !insertish ? Math.max(0, len - 1) : len;
            this.cx = Math.max(0, Math.min(max, this.cx));
            if (this.cy < this.top) this.top = this.cy;
            if (this.cy >= this.top + this.textRows) this.top = this.cy - this.textRows + 1;
        }
        displayCol(line, cx) { let col = 0; for (let i = 0; i < cx && i < line.length; i++) col += line[i] === '\t' ? 4 - (col % 4) : 1; return col; }
        render() {
            const w = this.t.cols;
            const rows = [];
            const gutter = this.lineNumbers ? String(this.lines.length).length + 1 : 0;
            const tw = w - gutter;
            const vis = (line) => { let out = ''; for (const ch of line) { if (ch === '\t') out += ' '.repeat(4 - (out.length % 4)); else out += ch; } return out; };
            const curDisp = this.displayCol(this.lines[this.cy] || '', this.cx);
            if (curDisp < this.left) this.left = curDisp;
            if (curDisp >= this.left + tw - 1) this.left = curDisp - tw + 2;
            if (this.mode === 'nano') {
                const title = 'GNU nano 7.2';
                const fname = this.name ? this.name : 'New Buffer';
                const mod = this.modified ? 'Modified' : '';
                const mid = Math.max(0, Math.floor((w - fname.length) / 2));
                let header = '  ' + title;
                header = header.padEnd(mid) + fname;
                header = header.padEnd(w - mod.length - 2) + mod + '  ';
                rows.push(INV + header.slice(0, w).padEnd(w) + RST);
            }
            for (let i = 0; i < this.textRows; i++) {
                const idx = this.top + i;
                if (idx >= this.lines.length) { rows.push(this.mode === 'vim' ? '\x1b[1;34m~\x1b[0m' : ''); continue; }
                const v = vis(this.lines[idx]);
                let seg = v.slice(this.left, this.left + tw);
                let row = (this.lineNumbers ? '\x1b[33m' + String(idx + 1).padStart(gutter - 1) + '\x1b[0m ' : '');
                if (idx === this.cy && !this.prompt && this.cmdline === null) {
                    const c = curDisp - this.left;
                    const chars = seg.padEnd(c + 1);
                    row += this.escape(chars.slice(0, c)) + '\x1b[7m' + (chars[c] || ' ') + '\x1b[27m' + this.escape(chars.slice(c + 1));
                } else row += this.escape(seg);
                rows.push(row);
            }
            if (this.mode === 'nano') {
                if (this.prompt) rows.push(INV + (this.prompt.label + this.prompt.value).padEnd(w).slice(0, w) + RST);
                else rows.push(this.message ? ' '.repeat(Math.max(0, Math.floor((w - this.message.length - 2) / 2))) + INV + ' ' + this.message + ' ' + RST : '');
                const keys = this.prompt && this.prompt.yesno ? [['Y', 'Yes'], ['N', 'No'], ['^C', 'Cancel']] : this.prompt ? [['^G', 'Help'], ['^C', 'Cancel'], ['Enter', 'Confirm']] : [['^G', 'Help'], ['^O', 'Write Out'], ['^W', 'Where Is'], ['^K', 'Cut'], ['^T', 'Execute'], ['^C', 'Location'], ['^X', 'Exit'], ['^R', 'Read File'], ['^\\', 'Replace'], ['^U', 'Paste'], ['^J', 'Justify'], ['^/', 'Go To Line']];
                const half = Math.ceil(keys.length / 2);
                const cell = Math.max(10, Math.floor(w / Math.max(1, half)));
                const line = (arr) => arr.map(([kk, d]) => (INV + kk + RST + ' ' + d).padEnd(cell + INV.length + RST.length)).join('');
                rows.push(line(keys.slice(0, half)));
                rows.push(line(keys.slice(half)));
            } else {
                if (this.cmdline !== null) rows.push(this.cmdline.prefix + this.cmdline.value + '\u2588');
                else {
                    const left = this.vimMode === 'insert' ? '\x1b[1m-- INSERT --\x1b[0m' : this.message;
                    const pos = (this.cy + 1) + ',' + (this.cx + 1);
                    const pct = this.lines.length <= this.textRows ? 'All' : this.top === 0 ? 'Top' : this.top + this.textRows >= this.lines.length ? 'Bot' : Math.round((this.top / (this.lines.length - this.textRows)) * 100) + '%';
                    rows.push(padVisible(truncVisible(left || '', w - 20), w - 18) + (this.count + this.pendingOp).padEnd(4) + pos.padEnd(10) + pct);
                }
            }
            this.t.renderRows(rows);
        }
        escape(s) { return s.replace(/\x1b/g, '^['); }
        save(asName) {
            const text = this.lines.join('\n') + '\n';
            const res = this.o.onSave ? this.o.onSave(text, asName) : { ok: true };
            if (typeof res === 'string') { this.message = res; return true; }
            if (res && res.error) { this.message = res.error; return false; }
            if (asName) { this.name = asName; this.path = asName; }
            this.modified = false;
            if (this.mode === 'nano') this.message = '[ Wrote ' + (res && res.lines !== undefined ? res.lines : this.lines.length) + ' line' + (this.lines.length === 1 ? '' : 's') + ' ]';
            else this.message = '"' + this.name + '" ' + (this.o.isNew && !this.savedOnce ? '[New] ' : '') + this.lines.length + 'L, ' + VFS.utf8Length(text) + 'B written';
            this.savedOnce = true;
            this.o.isNew = false;
            return true;
        }
        insertText(s) {
            const line = this.lines[this.cy];
            this.lines[this.cy] = line.slice(0, this.cx) + s + line.slice(this.cx);
            this.cx += s.length;
            this.modified = true;
        }
        newline() {
            const line = this.lines[this.cy];
            const indent = this.mode === 'vim' ? '' : '';
            this.lines.splice(this.cy + 1, 0, indent + line.slice(this.cx));
            this.lines[this.cy] = line.slice(0, this.cx);
            this.cy++; this.cx = indent.length;
            this.modified = true;
        }
        backspace() {
            if (this.cx > 0) { const l = this.lines[this.cy]; this.lines[this.cy] = l.slice(0, this.cx - 1) + l.slice(this.cx); this.cx--; this.modified = true; }
            else if (this.cy > 0) { const prev = this.lines[this.cy - 1]; this.cx = prev.length; this.lines[this.cy - 1] = prev + this.lines[this.cy]; this.lines.splice(this.cy, 1); this.cy--; this.modified = true; }
        }
        del() {
            const l = this.lines[this.cy];
            if (this.cx < l.length) { this.lines[this.cy] = l.slice(0, this.cx) + l.slice(this.cx + 1); this.modified = true; }
            else if (this.cy < this.lines.length - 1) { this.lines[this.cy] = l + this.lines[this.cy + 1]; this.lines.splice(this.cy + 1, 1); this.modified = true; }
        }
        move(k) {
            switch (k) {
                case 'ArrowUp': this.cy--; break;
                case 'ArrowDown': this.cy++; break;
                case 'ArrowLeft': if (this.cx > 0) this.cx--; else if (this.mode === 'nano' && this.cy > 0) { this.cy--; this.cx = this.lines[this.cy].length; } break;
                case 'ArrowRight': if (this.cx < this.lines[this.cy].length) this.cx++; else if (this.mode === 'nano' && this.cy < this.lines.length - 1) { this.cy++; this.cx = 0; } break;
                case 'Home': this.cx = 0; break;
                case 'End': this.cx = this.lines[this.cy].length; break;
                case 'PageUp': this.cy -= this.textRows; this.top = Math.max(0, this.top - this.textRows); break;
                case 'PageDown': this.cy += this.textRows; this.top = Math.min(Math.max(0, this.lines.length - 1), this.top + this.textRows); break;
                default: return false;
            }
            this.clampCursor(this.mode === 'nano' || this.vimMode === 'insert');
            return true;
        }
        onWheel(dy) { this.cy += dy > 0 ? 3 : -3; this.clampCursor(true); this.render(); }
        search(term, dir) {
            if (!term) return false;
            const n = this.lines.length;
            for (let step = 1; step <= n; step++) {
                const i = ((this.cy + (dir > 0 ? 0 : 0)) + dir * step + n * 10) % n;
                const from = step === n ? (dir > 0 ? this.cx + 1 : 0) : 0;
                void from;
                const pos = this.lines[i].indexOf(term);
                if (pos !== -1) { this.cy = i; this.cx = pos; this.clampCursor(true); return true; }
            }
            const pos = this.lines[this.cy].indexOf(term, this.cx + 1);
            if (pos !== -1) { this.cx = pos; return true; }
            return false;
        }
        onKey(ev) {
            if (this.mode === 'nano') this.nanoKey(ev); else this.vimKey(ev);
            if (this.t.app === this) this.render();
        }
        // ---------- nano ----------
        nanoKey(ev) {
            const k = ev.key;
            if (this.prompt) {
                const p = this.prompt;
                if (p.yesno) {
                    const c = (ev.char || k).toLowerCase();
                    if (c === 'y') { this.prompt = null; p.onYes(); }
                    else if (c === 'n') { this.prompt = null; p.onNo(); }
                    else if (k === 'ctrl+c' || k === 'Escape') { this.prompt = null; this.message = '[ Cancelled ]'; }
                    return;
                }
                if (k === 'Enter') { this.prompt = null; p.onDone(p.value); return; }
                if (k === 'ctrl+c' || k === 'Escape') { this.prompt = null; this.message = '[ Cancelled ]'; return; }
                if (k === 'Backspace') { p.value = p.value.slice(0, -1); return; }
                if (ev.char) p.value += ev.char;
                return;
            }
            this.message = '';
            if (ev.char) { if (!this.readonly || true) { if (!this.typing) this.snapshot(); this.typing = true; this.insertText(ev.char); } this.lastWasCut = false; return; }
            this.typing = false;
            if (this.move(k)) { this.lastWasCut = false; return; }
            switch (k) {
                case 'Enter': this.snapshot(); this.newline(); break;
                case 'Backspace': case 'ctrl+h': this.snapshot(); this.backspace(); break;
                case 'Delete': case 'ctrl+d': this.snapshot(); this.del(); break;
                case 'Tab': this.snapshot(); this.insertText('\t'); break;
                case 'ctrl+a': this.cx = 0; break;
                case 'ctrl+e': this.cx = this.lines[this.cy].length; break;
                case 'ctrl+y': this.move('PageUp'); break;
                case 'ctrl+v': this.move('PageDown'); break;
                case 'ctrl+k': {
                    this.snapshot();
                    if (!this.lastWasCut) this.cutBuffer = [];
                    this.cutBuffer.push(this.lines[this.cy]);
                    if (this.lines.length > 1) this.lines.splice(this.cy, 1); else this.lines[0] = '';
                    this.cx = 0; this.clampCursor(true); this.modified = true; this.lastWasCut = true;
                    return;
                }
                case 'ctrl+u':
                    if (this.cutBuffer.length) { this.snapshot(); this.lines.splice(this.cy, 0, ...this.cutBuffer); this.cy += this.cutBuffer.length; this.cx = 0; this.modified = true; }
                    break;
                case 'alt+u': case 'ctrl+z': this.restore(this.undo, this.redo); break;
                case 'alt+e': this.restore(this.redo, this.undo); break;
                case 'ctrl+o': case 'ctrl+s':
                    if (k === 'ctrl+s' && this.name) { this.save(); break; }
                    this.prompt = { label: 'File Name to Write: ', value: this.name || '', onDone: (v) => { if (!v) { this.message = '[ Cancelled ]'; return; } this.save(v !== this.name ? v : undefined); } };
                    break;
                case 'ctrl+x':
                    if (this.modified) {
                        this.prompt = {
                            label: 'Save modified buffer?  ', yesno: true, value: '',
                            onYes: () => { this.prompt = { label: 'File Name to Write: ', value: this.name || '', onDone: (v) => { if (v && this.save(v !== this.name ? v : undefined)) this.t.closeApp(); } }; },
                            onNo: () => this.t.closeApp()
                        };
                    } else this.t.closeApp();
                    return;
                case 'ctrl+w': case 'ctrl+q':
                    this.prompt = { label: 'Search' + (this.lastSearch ? ' [' + this.lastSearch + ']' : '') + ': ', value: '', onDone: (v) => { const term = v || this.lastSearch; this.lastSearch = term; if (!this.search(term, 1)) this.message = '[ "' + term + '" not found ]'; } };
                    break;
                case 'ctrl+\\':
                    this.prompt = { label: 'Search (to replace): ', value: '', onDone: (from) => { if (!from) return; this.prompt = { label: 'Replace with: ', value: '', onDone: (to) => { this.snapshot(); let n = 0; this.lines = this.lines.map((l) => { const parts = l.split(from); n += parts.length - 1; return parts.join(to); }); if (n) this.modified = true; this.message = '[ Replaced ' + n + ' occurrence' + (n === 1 ? '' : 's') + ' ]'; } }; } };
                    break;
                case 'ctrl+c': {
                    const total = this.lines.join('\n').length;
                    const ch = this.lines.slice(0, this.cy).join('\n').length + (this.cy ? 1 : 0) + this.cx;
                    this.message = '[ line ' + (this.cy + 1) + '/' + this.lines.length + ' (' + Math.round(((this.cy + 1) / this.lines.length) * 100) + '%), col ' + (this.cx + 1) + '/' + (this.lines[this.cy].length + 1) + ' (' + Math.round(((this.cx + 1) / (this.lines[this.cy].length + 1)) * 100) + '%), char ' + ch + '/' + total + ' (' + (total ? Math.round((ch / total) * 100) : 0) + '%) ]';
                    break;
                }
                case 'ctrl+/': case 'ctrl+_':
                    this.prompt = { label: 'Enter line number, column number: ', value: '', onDone: (v) => { const [l, c] = v.split(/[ ,]/).map((x) => parseInt(x, 10)); if (l) { this.cy = l - 1; this.cx = (c || 1) - 1; this.clampCursor(true); } } };
                    break;
                case 'ctrl+g':
                    this.helpSaved = { lines: this.lines, cy: this.cy, cx: this.cx, top: this.top, modified: this.modified };
                    this.message = 'Help: ^O save  ^X exit  ^K cut line  ^U paste  ^W search  ^\\ replace  ^C position  ^_ go to line  M-U undo';
                    break;
                case 'ctrl+r': this.prompt = { label: 'File to insert: ', value: '', onDone: (v) => { try { const txt = this.t.shell.fs.readFile(this.t.shell.resolve(v)); this.snapshot(); const ins = txt.replace(/\n$/, '').split('\n'); this.lines.splice(this.cy, 0, ...ins); this.modified = true; this.message = '[ Read ' + ins.length + ' lines ]'; } catch (e) { this.message = '[ Error reading ' + v + ': ' + e.message + ' ]'; } } }; break;
                case 'ctrl+t': this.message = '[ Executing commands is disabled in the sandbox editor ]'; break;
                case 'ctrl+j': this.message = '[ Justify is not available ]'; break;
            }
            this.lastWasCut = false;
            this.clampCursor(true);
        }
        // ---------- vim ----------
        vimKey(ev) {
            const k = ev.char || ev.key;
            if (this.cmdline !== null) return this.vimCmdlineKey(ev);
            if (this.vimMode === 'insert') {
                if (k === 'Escape' || k === 'ctrl+[' || k === 'ctrl+c') { this.vimMode = 'normal'; if (this.cx > 0) this.cx--; this.clampCursor(); return; }
                if (ev.char) { this.insertText(ev.char); return; }
                if (this.move(ev.key)) return;
                switch (ev.key) {
                    case 'Enter': this.newline(); return;
                    case 'Backspace': this.backspace(); return;
                    case 'Delete': this.del(); return;
                    case 'Tab': this.insertText('\t'); return;
                    case 'ctrl+w': { const l = this.lines[this.cy]; let p = this.cx; while (p > 0 && l[p - 1] === ' ') p--; while (p > 0 && l[p - 1] !== ' ') p--; this.lines[this.cy] = l.slice(0, p) + l.slice(this.cx); this.cx = p; this.modified = true; return; }
                }
                return;
            }
            // normal mode
            this.message = this.message && /written|E\d+|Already|lines|substitution|Pattern|readonly|search hit/.test(this.message) ? this.message : '';
            if (/^[0-9]$/.test(k) && !(k === '0' && !this.count)) { this.count += k; return; }
            const n = parseInt(this.count || '1', 10);
            const op = this.pendingOp;
            if (op) {
                this.pendingOp = '';
                this.count = '';
                const full = op + k;
                if (full === 'dd') { this.snapshot(); this.yank = { lines: this.lines.splice(this.cy, n) }; if (!this.lines.length) this.lines = ['']; this.modified = true; this.clampCursor(); if (n > 2) this.message = n + ' fewer lines'; return; }
                if (full === 'yy') { this.yank = { lines: this.lines.slice(this.cy, this.cy + n) }; if (n > 2) this.message = n + ' lines yanked'; return; }
                if (full === 'cc') { this.snapshot(); this.lines[this.cy] = ''; this.cx = 0; this.vimMode = 'insert'; this.modified = true; return; }
                if (full === 'dw' || full === 'cw' || full === 'de' || full === 'ce') {
                    this.snapshot();
                    const l = this.lines[this.cy];
                    let e = this.cx;
                    for (let c = 0; c < n; c++) { while (e < l.length && /\w/.test(l[e])) e++; if (full[1] === 'w' && full[0] === 'd') while (e < l.length && l[e] === ' ') e++; if (e === this.cx) e++; }
                    this.yank = { text: l.slice(this.cx, e) };
                    this.lines[this.cy] = l.slice(0, this.cx) + l.slice(e);
                    this.modified = true;
                    if (full[0] === 'c') this.vimMode = 'insert'; else this.clampCursor();
                    return;
                }
                if (full === 'd$') { this.snapshot(); this.lines[this.cy] = this.lines[this.cy].slice(0, this.cx); this.modified = true; this.clampCursor(); return; }
                if (full === 'gg') { this.cy = this.count ? n - 1 : 0; this.cx = 0; this.clampCursor(); return; }
                if (full === 'ZZ') { if (this.modified && !this.save()) return; this.t.closeApp(); return; }
                if (full === 'ZQ') { this.t.closeApp(); return; }
                if (op === 'r' && ev.char) { this.snapshot(); const l = this.lines[this.cy]; if (l.length) { this.lines[this.cy] = l.slice(0, this.cx) + ev.char + l.slice(this.cx + 1); this.modified = true; } return; }
                return;
            }
            this.count = '';
            switch (k) {
                case 'h': case 'ArrowLeft': case 'Backspace': this.cx -= n; break;
                case 'l': case 'ArrowRight': case ' ': this.cx += n; break;
                case 'j': case 'ArrowDown': case 'Enter': case 'ctrl+n': this.cy += n; break;
                case 'k': case 'ArrowUp': case 'ctrl+p': this.cy -= n; break;
                case '0': case 'Home': this.cx = 0; break;
                case '^': this.cx = (this.lines[this.cy].match(/^\s*/) || [''])[0].length; break;
                case '$': case 'End': this.cx = this.lines[this.cy].length; break;
                case 'w': for (let c = 0; c < n; c++) { const l = this.lines[this.cy]; let p = this.cx; while (p < l.length && /\w/.test(l[p])) p++; while (p < l.length && !/\w/.test(l[p])) p++; if (p >= l.length && this.cy < this.lines.length - 1) { this.cy++; this.cx = 0; } else this.cx = p; } break;
                case 'b': for (let c = 0; c < n; c++) { const l = this.lines[this.cy]; let p = this.cx; while (p > 0 && !/\w/.test(l[p - 1])) p--; while (p > 0 && /\w/.test(l[p - 1])) p--; this.cx = p; } break;
                case 'e': { const l = this.lines[this.cy]; let p = this.cx + 1; while (p < l.length && !/\w/.test(l[p])) p++; while (p < l.length - 1 && /\w/.test(l[p + 1])) p++; this.cx = p; break; }
                case 'G': this.cy = n > 1 || this.countUsed ? n - 1 : this.lines.length - 1; this.cx = 0; break;
                case 'PageDown': case 'ctrl+f': this.move('PageDown'); break;
                case 'PageUp': case 'ctrl+b': this.move('PageUp'); break;
                case 'ctrl+d': this.cy += Math.floor(this.textRows / 2); break;
                case 'ctrl+u': this.cy -= Math.floor(this.textRows / 2); break;
                case 'i': case 'Insert': this.snapshot(); this.vimMode = 'insert'; break;
                case 'a': this.snapshot(); this.vimMode = 'insert'; if (this.lines[this.cy].length) this.cx++; break;
                case 'I': this.snapshot(); this.vimMode = 'insert'; this.cx = (this.lines[this.cy].match(/^\s*/) || [''])[0].length; break;
                case 'A': this.snapshot(); this.vimMode = 'insert'; this.cx = this.lines[this.cy].length; this.clampCursor(true); return;
                case 'o': this.snapshot(); this.lines.splice(this.cy + 1, 0, ''); this.cy++; this.cx = 0; this.vimMode = 'insert'; this.modified = true; return;
                case 'O': this.snapshot(); this.lines.splice(this.cy, 0, ''); this.cx = 0; this.vimMode = 'insert'; this.modified = true; return;
                case 'x': case 'Delete': { this.snapshot(); const l = this.lines[this.cy]; if (l.length) { this.yank = { text: l.slice(this.cx, this.cx + n) }; this.lines[this.cy] = l.slice(0, this.cx) + l.slice(this.cx + n); this.modified = true; } break; }
                case 'X': { this.snapshot(); const l = this.lines[this.cy]; if (this.cx > 0) { const s = Math.max(0, this.cx - n); this.lines[this.cy] = l.slice(0, s) + l.slice(this.cx); this.cx = s; this.modified = true; } break; }
                case 'D': this.snapshot(); this.lines[this.cy] = this.lines[this.cy].slice(0, this.cx); this.modified = true; break;
                case 'C': this.snapshot(); this.lines[this.cy] = this.lines[this.cy].slice(0, this.cx); this.modified = true; this.vimMode = 'insert'; return;
                case 's': this.snapshot(); { const l = this.lines[this.cy]; this.lines[this.cy] = l.slice(0, this.cx) + l.slice(this.cx + 1); this.modified = true; this.vimMode = 'insert'; } return;
                case 'J': if (this.cy < this.lines.length - 1) { this.snapshot(); const nl = this.lines[this.cy + 1].replace(/^\s+/, ''); this.cx = this.lines[this.cy].length; this.lines[this.cy] = this.lines[this.cy].replace(/\s+$/, '') + (nl ? ' ' : '') + nl; this.lines.splice(this.cy + 1, 1); this.modified = true; } break;
                case 'p': case 'P':
                    if (!this.yank) break;
                    this.snapshot();
                    if (this.yank.lines) { const at = k === 'p' ? this.cy + 1 : this.cy; this.lines.splice(at, 0, ...this.yank.lines); this.cy = at; this.cx = 0; }
                    else { const l = this.lines[this.cy]; const at = k === 'p' && l.length ? this.cx + 1 : this.cx; this.lines[this.cy] = l.slice(0, at) + this.yank.text + l.slice(at); this.cx = at + this.yank.text.length - 1; }
                    this.modified = true;
                    break;
                case 'u': this.restore(this.undo, this.redo); break;
                case 'ctrl+r': this.restore(this.redo, this.undo); break;
                case 'd': case 'y': case 'c': case 'g': case 'Z': case 'r': this.pendingOp = k; this.count = n > 1 ? String(n) : ''; return;
                case ':': this.cmdline = { prefix: ':', value: '' }; return;
                case '/': this.cmdline = { prefix: '/', value: '' }; return;
                case '?': this.cmdline = { prefix: '?', value: '' }; return;
                case 'n': if (this.lastSearch && !this.search(this.lastSearch, 1)) this.message = 'E486: Pattern not found: ' + this.lastSearch; break;
                case 'N': if (this.lastSearch && !this.search(this.lastSearch, -1)) this.message = 'E486: Pattern not found: ' + this.lastSearch; break;
                case 'ctrl+g': this.message = '"' + (this.name || '[No Name]') + '"' + (this.modified ? ' [Modified]' : '') + ' ' + this.lines.length + ' lines --' + Math.round(((this.cy + 1) / this.lines.length) * 100) + '%--'; break;
                case 'Escape': this.bellish = true; break;
            }
            this.clampCursor();
        }
        vimCmdlineKey(ev) {
            const c = this.cmdline;
            if (ev.key === 'Escape' || ev.key === 'ctrl+c') { this.cmdline = null; return; }
            if (ev.key === 'Backspace') { if (!c.value) this.cmdline = null; else c.value = c.value.slice(0, -1); return; }
            if (ev.key !== 'Enter') { if (ev.char) c.value += ev.char; return; }
            this.cmdline = null;
            const v = c.value;
            if (c.prefix === '/' || c.prefix === '?') {
                const term = v || this.lastSearch;
                this.lastSearch = term;
                if (!this.search(term, c.prefix === '/' ? 1 : -1)) this.message = 'E486: Pattern not found: ' + term;
                return;
            }
            this.execEx(v.trim());
        }
        execEx(cmd) {
            let m;
            if (/^\d+$/.test(cmd)) { this.cy = parseInt(cmd, 10) - 1; this.cx = 0; this.clampCursor(); return; }
            if (cmd === '$') { this.cy = this.lines.length - 1; this.clampCursor(); return; }
            if ((m = /^(%|\d+,\d+|\.)?s\/((?:\\.|[^\/])*)\/((?:\\.|[^\/])*)\/?([gi]*)$/.exec(cmd))) {
                let from = 0, to = this.lines.length - 1;
                if (!m[1] || m[1] === '.') { from = to = this.cy; }
                else if (m[1] !== '%') { const [a, b] = m[1].split(',').map((x) => parseInt(x, 10) - 1); from = a; to = b; }
                let re;
                try { re = new RegExp(LA.util.posixToJs(m[2].replace(/\\\//g, '/'), false), m[4].includes('i') ? (m[4].includes('g') ? 'gi' : 'i') : (m[4].includes('g') ? 'g' : '')); }
                catch (e) { this.message = 'E486: Pattern not found: ' + m[2]; return; }
                this.snapshot();
                let count = 0, linesChanged = 0;
                for (let i = from; i <= to && i < this.lines.length; i++) {
                    let hit = false;
                    this.lines[i] = this.lines[i].replace(re, (...args) => { count++; hit = true; return m[3].replace(/\\(\d)/g, (x, d) => args[+d] || '').replace(/&/g, args[0]); });
                    if (hit) linesChanged++;
                }
                if (!count) { this.undo.pop(); this.message = 'E486: Pattern not found: ' + m[2]; return; }
                this.modified = true;
                if (count > 1) this.message = count + ' substitution' + (count > 1 ? 's' : '') + ' on ' + linesChanged + ' line' + (linesChanged > 1 ? 's' : '');
                return;
            }
            if ((m = /^set\s+(no)?(nu|number)$/.exec(cmd))) { this.lineNumbers = !m[1]; return; }
            if (/^(syntax|set)\b/.test(cmd)) return;
            const force = cmd.endsWith('!');
            const base = cmd.replace(/!$/, '');
            const parts = base.split(/\s+/);
            switch (parts[0]) {
                case 'w': case 'write': {
                    if (this.readonly && !force) { this.message = 'E45: \'readonly\' option is set (add ! to override)'; return; }
                    if (!parts[1] && !this.path && !this.name) { this.message = 'E32: No file name'; return; }
                    this.save(parts[1]);
                    return;
                }
                case 'wq': case 'x': case 'xit': case 'exit': {
                    if (!this.modified && parts[0] !== 'wq') { this.t.closeApp(); return; }
                    if (!parts[1] && !this.path && !this.name) { this.message = 'E32: No file name'; return; }
                    if (this.readonly && !force) { this.message = 'E45: \'readonly\' option is set (add ! to override)'; return; }
                    if (this.save(parts[1])) this.t.closeApp();
                    return;
                }
                case 'q': case 'quit':
                    if (this.modified && !force) { this.message = 'E37: No write since last change (add ! to override)'; return; }
                    this.t.closeApp();
                    return;
                case 'qa': case 'qall': this.t.closeApp(); return;
                case 'e': case 'edit': this.message = 'E37: opening other files is not supported here'; return;
                case 'help': case 'h': this.message = 'i=insert  Esc=normal  :w save  :q quit  :wq both  :q! discard  dd del line  yy copy  p paste  u undo  /text search  :%s/a/b/g replace'; return;
                case '': return;
            }
            this.message = 'E492: Not an editor command: ' + cmd;
        }
    }

    // ------------------------------------------------------------------ top / htop
    class TopApp {
        constructor(term, o) {
            this.t = term;
            this.htop = !!o.htop;
            this.sortMem = false;
            this.sel = 0;
            this.prompt = null;
            this.message = '';
            this.timer = setInterval(() => { if (this.t.app === this) this.render(); }, 1500);
        }
        destroy() { clearInterval(this.timer); }
        procRows() {
            const sh = this.t.shell;
            sh.system.reap();
            const list = sh.system.processes.slice();
            if (!list.some((p) => p.pid === 1002)) list.push({ pid: 1002, user: sh.user, cmd: '-bash', stat: 'S', cpu: 0, mem: 0, vsz: 10248, rss: 5280, start: sh.system.bootTime });
            const j = (x) => Math.max(0, x + (Math.random() - 0.5) * Math.max(0.4, x * 0.2));
            return list.map((p) => Object.assign({}, p, { cpu: j(p.cpu), mem: p.mem })).sort((a, b) => (this.sortMem ? b.mem - a.mem : b.cpu - a.cpu) || a.pid - b.pid);
        }
        render() {
            const w = this.t.cols, h = this.t.rows;
            const procs = this.procRows();
            this.procs = procs;
            const rows = [];
            const sh = this.t.shell;
            if (this.htop) {
                const bar = (label, pct, color) => {
                    const width = Math.max(10, Math.floor(w / 2) - 12);
                    const fill = Math.round((pct / 100) * width);
                    return '\x1b[1;36m' + label.padStart(3) + '\x1b[0m[' + color + '|'.repeat(fill) + '\x1b[0m' + ' '.repeat(Math.max(0, width - fill)) + (pct.toFixed(1) + '%').padStart(6) + ']';
                };
                const tot = Math.min(100, procs.reduce((a, p) => a + p.cpu, 0) / 4);
                for (let c = 0; c < 4; c++) rows.push(bar(String(c), Math.min(100, Math.max(0.5, tot + (Math.random() - 0.5) * 20)), '\x1b[32m') + '   ' + (c === 0 ? '\x1b[1;36mTasks: \x1b[0m' + procs.length + ', 1 running' : c === 1 ? '\x1b[1;36mLoad average: \x1b[0m0.42 0.35 0.28' : c === 2 ? '\x1b[1;36mUptime: \x1b[0m' + Math.floor(sh.system.uptimeSeconds() / 86400) + ' days' : ''));
                rows.push(bar('Mem', 27.7, '\x1b[32m') + '   2.14G/7.75G');
                rows.push(bar('Swp', 0.0, '\x1b[31m') + '   0K/2.00G');
                rows.push('');
                rows.push('\x1b[30;42m' + '    PID USER       PRI  NI  VIRT   RES S  CPU% MEM%   TIME+  Command'.padEnd(w) + '\x1b[0m');
            } else {
                const lines = LA.topSnapshot(sh, { jitter: true, sortMem: this.sortMem });
                for (let i = 0; i < 5; i++) rows.push(lines[i]);
                rows.push(this.prompt ? this.prompt.label + this.prompt.value + '\u2588' : this.message);
                rows.push(INV + lines[6].padEnd(w) + RST);
            }
            const avail = h - rows.length - (this.htop ? 1 : 0);
            this.sel = Math.max(0, Math.min(procs.length - 1, this.sel));
            const start = Math.max(0, Math.min(this.sel - avail + 1, procs.length - avail));
            for (let i = 0; i < avail; i++) {
                const p = procs[start + i];
                if (!p) { rows.push(''); continue; }
                const comm = this.htop ? p.cmd : LA.procComm(p.cmd);
                let line = String(p.pid).padStart(7) + ' ' + p.user.slice(0, 8).padEnd(8) + '  20   0 ' + String(p.vsz).padStart(7) + ' ' + String(p.rss).padStart(6) + ' ' + (this.htop ? '' : String(Math.floor(p.rss * 0.6)).padStart(6) + ' ') + p.stat[0] + ' ' + p.cpu.toFixed(1).padStart(5) + ' ' + p.mem.toFixed(1).padStart(5) + '   0:' + String(p.pid % 60).padStart(2, '0') + '.' + String(p.pid % 100).padStart(2, '0') + ' ' + comm;
                line = line.slice(0, w);
                if (this.htop && start + i === this.sel) line = '\x1b[30;46m' + line.padEnd(w) + '\x1b[0m';
                else if (p.stat[0] === 'R' && !this.htop) line = '\x1b[1m' + line + '\x1b[0m';
                rows.push(line);
            }
            if (this.htop) {
                const keys = [['F1', 'Help'], ['F3', 'Search'], ['F6', 'SortBy'], ['F9', 'Kill'], ['F10', 'Quit']];
                rows.push(this.prompt ? this.prompt.label + this.prompt.value + '\u2588' : this.message ? this.message : keys.map(([k, d]) => '\x1b[0m' + k + '\x1b[30;46m' + d.padEnd(6) + '\x1b[0m').join(''));
            }
            this.t.renderRows(rows);
        }
        killPid(pid, sig) {
            const sh = this.t.shell;
            const r = sh.system.signalProcess(pid, sig || 'TERM', sh.user);
            this.message = r === 'OK' ? 'Sent signal ' + (sig || 'TERM') + ' to ' + pid : r === 'EPERM' ? 'Failed signal pid \'' + pid + '\' with ' + (sig || 15) + ': Operation not permitted' : 'Failed signal pid \'' + pid + '\': No such process';
            if (this.t.opts.onAppClose) this.t.opts.onAppClose(this.t);
        }
        onKey(ev) {
            const k = ev.char || ev.key;
            if (this.prompt) {
                if (ev.key === 'Enter') { const v = this.prompt.value; const p = this.prompt; this.prompt = null; p.onDone(v); this.render(); return; }
                if (ev.key === 'Escape') { this.prompt = null; this.render(); return; }
                if (ev.key === 'Backspace') { this.prompt.value = this.prompt.value.slice(0, -1); this.render(); return; }
                if (ev.char) this.prompt.value += ev.char;
                this.render();
                return;
            }
            this.message = '';
            switch (k) {
                case 'q': case 'F10': case 'ctrl+c': case 'Escape': this.t.closeApp(); return;
                case 'M': this.sortMem = true; break;
                case 'P': this.sortMem = false; break;
                case 'ArrowDown': case 'j': this.sel++; break;
                case 'ArrowUp': this.sel--; break;
                case 'PageDown': this.sel += 10; break;
                case 'PageUp': this.sel -= 10; break;
                case 'F6': this.sortMem = !this.sortMem; break;
                case 'F9': case 'k':
                    if (this.htop) { const p = this.procs && this.procs[this.sel]; if (p) this.killPid(p.pid, 'TERM'); }
                    else { const def = this.procs && this.procs[0] ? this.procs[0].pid : ''; this.prompt = { label: 'PID to signal/kill [default pid = ' + def + '] ', value: '', onDone: (v) => this.killPid(parseInt(v || def, 10), 'TERM') }; }
                    break;
                case 'h': case 'F1': case '?': this.message = this.htop ? 'Arrows: select  F9/k: kill  F6: sort  q/F10: quit' : 'P: sort by CPU  M: sort by memory  k: kill  q: quit'; break;
            }
            this.render();
        }
    }

    // ------------------------------------------------------------------ animations (sl, cmatrix)
    class AnimationApp {
        constructor(term, kind) {
            this.t = term;
            this.kind = kind;
            this.frame = 0;
            this.cols = [];
            this.timer = setInterval(() => this.tick(), kind === 'matrix' ? 70 : 45);
        }
        destroy() { clearInterval(this.timer); }
        tick() { if (this.t.app !== this) return; this.frame++; this.render(); }
        render() {
            const w = this.t.cols, h = this.t.rows;
            const rows = [];
            if (this.kind === 'sl') {
                const train = ['      ====        ________                ___________ ', '  _D _|  |_______/        \\__I_I_____===__|_________| ', '   |(_)---  |   H\\________/ |   |        =|___ ___|   ', '   /     |  |   H  |  |     |   |         ||_| |_||   ', '  |      |  |   H  |__--------------------| [___] |   ', '  | ________|___H__/__|_____/[][]~\\_______|       |   ', '  |/ |   |-----------I_____I [][] []  D   |=======|__ ', '__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ', ' |/-=|___|=    ||    ||    ||    |_____/~\\___/        ', '  \\_/      \\O=====O=====O=====O_/      \\_/            '];
                const x = w - this.frame;
                if (x < -train[0].length) { this.t.closeApp(); return; }
                const smoke = this.frame % 4 < 2 ? '(@@@)' : ' (@@) ';
                const top = Math.max(0, Math.floor((h - train.length) / 2) - 2);
                for (let i = 0; i < h; i++) {
                    let line = ' '.repeat(w);
                    const ti = i - top;
                    const put = (s, at) => { for (let c = 0; c < s.length; c++) { const pos = at + c; if (pos >= 0 && pos < w) line = line.slice(0, pos) + s[c] + line.slice(pos + 1); } };
                    if (ti === -2) put(smoke + '   ' + smoke, x + 4);
                    if (ti >= 0 && ti < train.length) put(train[ti], x);
                    rows.push(line);
                }
            } else {
                const chars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789ABCDEF@#$%&*+=-';
                if (this.cols.length !== w) this.cols = Array.from({ length: w }, () => ({ y: -Math.floor(Math.random() * h), len: 5 + Math.floor(Math.random() * 15), speed: Math.random() < 0.5 ? 1 : 2 }));
                if (!this.grid || this.grid.length !== h) this.grid = Array.from({ length: h }, () => Array(w).fill(' '));
                for (let x = 0; x < w; x++) {
                    const c = this.cols[x];
                    if (this.frame % c.speed) continue;
                    c.y++;
                    if (c.y - c.len > h) { c.y = -Math.floor(Math.random() * 10); c.len = 5 + Math.floor(Math.random() * 15); }
                    for (let y = 0; y < h; y++) {
                        const d = c.y - y;
                        this.grid[y][x] = d === 0 ? '\x1b[1;37m' + chars[Math.floor(Math.random() * chars.length)] + '\x1b[0m' : d > 0 && d < c.len ? (Math.random() < 0.05 || this.grid[y][x] === ' ' || this.grid[y][x].length > 1 ? '\x1b[32m' + chars[Math.floor(Math.random() * chars.length)] + '\x1b[0m' : this.grid[y][x]) : ' ';
                    }
                }
                for (let y = 0; y < h; y++) rows.push(this.grid[y].join(''));
            }
            this.t.renderRows(rows);
        }
        onKey() { this.t.closeApp(); }
    }

    LA.Terminal = Terminal;
    LA.TerminalApps = { PagerApp, EditorApp, TopApp, AnimationApp };
})();
