// Linux Arsenal - application controller
// Ties the simulated Linux machine (js/*) to the UI: dashboard, terminal, challenges, achievements, analytics.
(function () {
    'use strict';
    const LA = window.LA;
    const STORE_KEY = 'linuxArsenal.v2';
    const FS_KEY = 'linuxArsenal.v2.machine';
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const today = () => new Date().toISOString().slice(0, 10);
    const storage = {
        get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
        del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
    };

    const DEFAULT_STATE = {
        xp: 0,
        completed: {},          // id -> { at, xp, time, hints }
        generated: [],          // ids of generated challenges
        achievements: [],
        commandCounts: {},      // command name -> count
        totalCommands: 0,
        okCommands: 0,
        activity: {},           // YYYY-MM-DD -> { commands, challenges, seconds }
        skills: { 'file-ops': 0, 'text-proc': 0, 'sys-admin': 0, networking: 0, security: 0, scripting: 0 },
        tutorialStep: 0,
        tutorialDone: false,
        feed: [],
        history: [],
        settings: { theme: 'arsenal', fontSize: 14, cursor: 'block', blink: true, autoHints: true, sound: false }
    };
    const SKILL_OF_CATEGORY = {
        'Files & Navigation': 'file-ops', 'Archives': 'file-ops', 'Text Processing': 'text-proc', 'Pipes & Redirection': 'text-proc',
        'System Information': 'sys-admin', 'Services': 'sys-admin', 'Processes': 'sys-admin', 'Users & Groups': 'sys-admin', 'Package Management': 'sys-admin', 'Scenarios': 'sys-admin',
        'Networking': 'networking', 'Containers': 'networking', 'Security': 'security', 'Permissions': 'security', 'Shell Scripting': 'scripting', 'Git': 'scripting'
    };
    const SKILL_OF_COMMAND = {};
    for (const c of ['ls', 'cd', 'pwd', 'mkdir', 'rmdir', 'touch', 'cp', 'mv', 'rm', 'ln', 'find', 'tree', 'stat', 'file', 'du', 'tar', 'gzip', 'zip', 'unzip', 'locate']) SKILL_OF_COMMAND[c] = 'file-ops';
    for (const c of ['cat', 'grep', 'egrep', 'sed', 'awk', 'sort', 'uniq', 'cut', 'tr', 'wc', 'head', 'tail', 'less', 'diff', 'paste', 'xargs', 'tee', 'nl', 'rev', 'column', 'jq']) SKILL_OF_COMMAND[c] = 'text-proc';
    for (const c of ['ps', 'top', 'htop', 'kill', 'killall', 'pkill', 'systemctl', 'service', 'journalctl', 'apt', 'apt-get', 'dpkg', 'df', 'free', 'uptime', 'uname', 'useradd', 'usermod', 'crontab', 'sudo', 'su', 'mount', 'lsblk', 'lscpu']) SKILL_OF_COMMAND[c] = 'sys-admin';
    for (const c of ['ping', 'curl', 'wget', 'ip', 'ifconfig', 'ss', 'netstat', 'dig', 'nslookup', 'host', 'traceroute', 'nmap', 'ssh', 'scp', 'nc', 'docker']) SKILL_OF_COMMAND[c] = 'networking';
    for (const c of ['chmod', 'chown', 'chgrp', 'umask', 'ufw', 'iptables', 'sha256sum', 'md5sum', 'base64', 'passwd', 'gpasswd']) SKILL_OF_COMMAND[c] = 'security';
    for (const c of ['echo', 'printf', 'export', 'alias', 'for', 'while', 'if', 'read', 'test', 'source', 'bash', 'git', 'function', 'expr', 'bc', 'seq', 'env', 'set', 'history']) SKILL_OF_COMMAND[c] = 'scripting';

    // ================================================================ App
    class App {
        constructor() {
            this.state = this.loadState();
            this.challenges = LA.challenges.generateAll().slice();
            for (const id of this.state.generated) { const c = LA.challenges.fromId(id); if (c && !this.challenges.some((x) => x.id === id)) this.challenges.unshift(c); }
            this.byId = new Map(this.challenges.map((c) => [c.id, c]));
            this.filters = { difficulty: 'all', category: 'all', status: 'all', search: '' };
            this.shown = 0;
            this.pageSize = 30;
            this.session = null;           // modal challenge session
            this.termChallenge = null;     // challenge loaded in the main terminal
            this.sessionStart = Date.now();
            LA.app = this;
            this.registerAppCommands();
            this.machine = this.loadMachine();
            this.initTerminal();
            this.bindUI();
            this.applySettings();
            this.populateCategoryFilter();
            this.renderAll();
            setInterval(() => this.tickTime(), 60000);
            window.addEventListener('beforeunload', () => { this.tickTime(); this.saveMachine(); this.saveState(); });
            setInterval(() => this.saveMachine(), 20000);
        }

        // ---------------------------------------------------------- persistence
        loadState() {
            let s = null;
            try { s = JSON.parse(storage.get(STORE_KEY) || 'null'); } catch (e) { s = null; }
            const st = JSON.parse(JSON.stringify(DEFAULT_STATE));
            if (s && typeof s === 'object') {
                Object.assign(st, s);
                st.settings = Object.assign({}, DEFAULT_STATE.settings, s.settings || {});
                st.skills = Object.assign({}, DEFAULT_STATE.skills, s.skills || {});
            }
            return st;
        }
        saveState() {
            this.state.history = (this.terminal ? this.terminal.history : this.state.history).slice(-500);
            storage.set(STORE_KEY, JSON.stringify(this.state));
        }
        loadMachine() {
            let sh;
            try {
                const raw = storage.get(FS_KEY);
                if (raw) {
                    const data = JSON.parse(raw);
                    const fs = LA.VFS.deserialize(data.fs);
                    sh = LA.createMachine({ fs });
                    for (const k of ['users', 'groups', 'packages', 'crontabs', 'firewall', 'passwords']) if (data.sys && data.sys[k]) sh.system[k] = data.sys[k];
                    if (data.services) for (const [n, v] of Object.entries(data.services)) if (sh.system.services[n]) Object.assign(sh.system.services[n], v), v.active ? sh.system.startService(n) : sh.system.stopService(n);
                    sh.applyUser();
                    if (data.cwd && fs.isDir(data.cwd)) { sh.cwd = data.cwd; sh.setVar('PWD', data.cwd); }
                    if (data.aliases) sh.aliases = Object.assign(Object.create(null), data.aliases);
                    if (data.vars) for (const [k, v] of Object.entries(data.vars)) sh.vars.set(k, v);
                }
            } catch (e) { console.warn('Could not restore machine, starting fresh', e); sh = null; }
            if (!sh) sh = LA.createMachine();
            sh.history = this.state.history || [];
            return sh;
        }
        saveMachine() {
            const sh = this.machine;
            if (!sh) return;
            try {
                const services = {};
                for (const [n, v] of Object.entries(sh.system.services)) services[n] = { active: v.active, enabled: v.enabled };
                const vars = {};
                for (const [k, v] of sh.vars) if (!['PWD', 'OLDPWD'].includes(k)) vars[k] = v;
                const data = { fs: sh.fs.serialize(), sys: { users: sh.system.users, groups: sh.system.groups, packages: sh.system.packages, crontabs: sh.system.crontabs, firewall: sh.system.firewall, passwords: sh.system.passwords }, services, cwd: sh.cwd, aliases: Object.assign({}, sh.aliases), vars };
                const json = JSON.stringify(data);
                if (json.length < 4 * 1024 * 1024) storage.set(FS_KEY, json);
            } catch (e) { console.warn('save machine failed', e); }
        }

        // ---------------------------------------------------------- main terminal
        banner() {
            const C = LA.util.C;
            return C.bgreen + 'Linux Arsenal' + C.reset + ' 2.0 - Ubuntu 24.04.1 LTS (simulated) - kernel 6.8.0-45-generic x86_64\n\n' +
                ' * A complete, sandboxed Linux machine runs in your browser: ' + Object.keys(LA.commands).length + '+ commands, real bash syntax.\n' +
                ' * New here? Type ' + C.byellow + 'tutorial' + C.reset + '.  Need help? ' + C.byellow + 'help' + C.reset + ', ' + C.byellow + 'man ls' + C.reset + ', ' + C.byellow + 'tldr tar' + C.reset + ', ' + C.byellow + 'examples grep' + C.reset + '.\n' +
                ' * Play: ' + C.byellow + 'challenge random' + C.reset + ' (' + this.challenges.length + ' challenges, each in its own sandbox).\n' +
                ' * Keys: Tab completion, Up/Down history, Ctrl+R search, Ctrl+L clear, Ctrl+C cancel.\n\n' +
                C.gray + ' Developed by ' + C.reset + C.bcyan + '0x0806' + C.reset + C.gray + ' - github.com/0x0806/Linux-Arsenal' + C.reset + '\n\n';
        }
        initTerminal() {
            const host = $('terminal-host');
            this.terminal = new LA.Terminal(host, {
                shell: this.machine,
                banner: this.banner(),
                onCommand: (line, info, term) => this.onMainCommand(line, info, term),
                onAppClose: () => this.onMainAppClose(),
                onExit: (term) => { term.writeln('logout\n(the terminal cannot be closed - a new session has been started)'); },
                onPrompt: () => this.updateStatusBar()
            });
            this.terminal.history = this.machine.history;
            this.updateStatusBar();
        }
        updateStatusBar() {
            const sh = this.terminal && this.terminal.shell;
            if (!sh) return;
            const home = sh.home;
            const cwd = sh.cwd === home ? '~' : sh.cwd.startsWith(home + '/') ? '~' + sh.cwd.slice(home.length) : sh.cwd;
            $('status-cwd').textContent = sh.user + '@' + sh.hostname + ':' + cwd;
            $('terminal-title').textContent = sh.user + '@' + sh.hostname + ': ' + cwd;
            $('status-exit').textContent = 'exit ' + sh.lastStatus;
            $('status-exit').className = sh.lastStatus === 0 ? 'ok' : 'bad';
            const mode = this.termChallenge ? '<i class="fas fa-trophy"></i> challenge #' + esc(this.termChallenge.challenge.number || '') + ': ' + esc(this.termChallenge.challenge.title) : this.state.tutorialStep > 0 && !this.state.tutorialDone && this.tutorialActive ? '<i class="fas fa-graduation-cap"></i> tutorial step ' + this.state.tutorialStep + '/' + LA.challenges.TUTORIAL.length : '<i class="fas fa-flask"></i> practice machine';
            $('status-mode').innerHTML = mode;
        }
        trackCommand(info) {
            const st = this.state;
            const names = info.execLog.map((a) => a[0].split('/').pop()).filter(Boolean);
            const first = info.line.trim().split(/\s+/)[0];
            if (!names.length && first) names.push(first);
            for (const n of new Set(names)) {
                st.commandCounts[n] = (st.commandCounts[n] || 0) + 1;
                const sk = SKILL_OF_COMMAND[n];
                if (sk && info.code === 0) st.skills[sk] = (st.skills[sk] || 0) + 2;
            }
            st.totalCommands++;
            if (info.code === 0) st.okCommands++;
            const d = this.day();
            d.commands++;
            const nowMs = Date.now();
            d.seconds += Math.min(60, Math.round((nowMs - (this.lastActive || nowMs - 5000)) / 1000));
            this.lastActive = nowMs;
            if (info.code === 0 && st.totalCommands % 10 === 0) this.addXp(5, null, true);
            $('typing-speed').textContent = st.totalCommands;
            $('command-accuracy').textContent = this.accuracy() + '%';
            this.updateHistoryPanel();
            this.updateHint(names[names.length - 1] || first);
            this.checkAchievements();
        }
        onMainCommand(line, info, term) {
            this.trackCommand(info);
            if (this.termChallenge) {
                const s = this.termChallenge;
                const wasSolved = s.solved;
                if (!wasSolved && !/^\s*challenge\b/.test(line) && s.afterCommand(info.stdout, info.cwdBefore)) this.finishTerminalChallenge();
                else if (this.state.settings.autoHints && s.attempts === 5 && s.hintsUsed === 0) term.writeln('\x1b[33m(stuck? type "challenge hint")\x1b[0m');
            } else if (this.tutorialActive) this.tutorialCheck(info);
            this.saveState();
        }
        onMainAppClose() {
            if (this.termChallenge && !this.termChallenge.solved && this.termChallenge.recheck()) this.finishTerminalChallenge();
            this.saveMachine();
        }

        // ---------------------------------------------------------- terminal app commands
        registerAppCommands() {
            const app = this;
            const C = LA.util.C;
            LA.util.register('challenge', (ctx) => {
                const [sub, ...rest] = ctx.args;
                const term = app.terminal;
                const cur = app.termChallenge;
                switch (sub || (cur ? 'info' : 'help')) {
                    case 'list': {
                        let list = app.challenges;
                        const diff = rest.find((r) => LA.challenges.DIFF_ORDER[r] !== undefined);
                        const words = rest.filter((r) => r !== diff).join(' ').toLowerCase();
                        if (diff) list = list.filter((c) => c.difficulty === diff);
                        if (words) list = list.filter((c) => (c.title + ' ' + c.category).toLowerCase().includes(words));
                        const shown = list.slice(0, 25);
                        for (const c of shown) ctx.outln((app.state.completed[c.id] ? C.green + '✔' : ' ') + ' ' + C.byellow + String(c.number || '*').padStart(4) + C.reset + '  ' + diffColor(c.difficulty) + c.difficulty.padEnd(12) + C.reset + ' ' + c.title + C.gray + '  [' + c.category + ']' + C.reset);
                        ctx.outln('\nShowing ' + shown.length + ' of ' + list.length + ' (filter: challenge list [beginner|intermediate|advanced|expert] [words]).');
                        ctx.outln('Start one with: challenge start NUMBER   or   challenge random [difficulty]');
                        return 0;
                    }
                    case 'start': case 'play': {
                        const key = rest[0];
                        const c = app.challenges.find((x) => String(x.number) === key || x.id === key);
                        if (!c) return ctx.fail('no challenge "' + (key || '') + '" (see challenge list)');
                        app.pendingTerminalChallenge = c;
                        return 0;
                    }
                    case 'random': case 'next': {
                        let pool = app.challenges.filter((c) => !app.state.completed[c.id]);
                        if (rest[0] && LA.challenges.DIFF_ORDER[rest[0]] !== undefined) pool = pool.filter((c) => c.difficulty === rest[0]);
                        if (!pool.length) pool = app.challenges;
                        app.pendingTerminalChallenge = sub === 'next' && cur ? (app.nextChallengeAfter(cur.challenge) || pool[0]) : pool[Math.floor(Math.random() * pool.length)];
                        return 0;
                    }
                    case 'info': case 'status':
                        if (!cur) return ctx.fail('no challenge loaded. Try: challenge random');
                        ctx.out(app.describeForTerminal(cur.challenge));
                        return 0;
                    case 'hint': {
                        if (!cur) return ctx.fail('no challenge loaded');
                        const h = cur.nextHint();
                        ctx.outln(C.byellow + 'Hint ' + cur.hintsUsed + '/' + cur.challenge.hints.length + ': ' + C.reset + h);
                        return 0;
                    }
                    case 'solution': case 'answer':
                        if (!cur) return ctx.fail('no challenge loaded');
                        cur.revealed = true;
                        ctx.outln(C.byellow + 'One possible solution' + C.reset + ' (half XP if you use it):\n  ' + cur.challenge.solution.split('\n').join('\n  '));
                        return 0;
                    case 'check':
                        if (!cur) return ctx.fail('no challenge loaded');
                        if (cur.solved) { ctx.outln('Already solved! Type "challenge next" for another one.'); return 0; }
                        if (cur.recheck()) { app.pendingFinish = true; return 0; }
                        ctx.outln('Not solved yet. ' + (LA.challenges.checkKind(cur.challenge).startsWith('output') || LA.challenges.checkKind(cur.challenge) === 'match' || LA.challenges.checkKind(cur.challenge) === 'paths' ? '(this challenge is checked on the output of your command)' : '(this challenge checks the state of the machine)'));
                        return 1;
                    case 'reset':
                        if (!cur) return ctx.fail('no challenge loaded');
                        app.pendingTerminalChallenge = cur.challenge;
                        return 0;
                    case 'quit': case 'exit': case 'stop':
                        if (!cur) return ctx.fail('no challenge loaded');
                        app.pendingQuitChallenge = true;
                        return 0;
                    case 'stats':
                        ctx.outln('Completed ' + Object.keys(app.state.completed).length + ' of ' + app.challenges.length + ' challenges, ' + app.state.xp + ' XP, level ' + app.level());
                        return 0;
                    default:
                        ctx.outln('Usage: challenge COMMAND\n\n  list [difficulty] [words]   browse challenges\n  start N                     load challenge number N into this terminal\n  random [difficulty]         load a random unsolved challenge\n  info                        show the current task again\n  hint                        progressive hints\n  solution                    reveal a solution (half XP)\n  check                       re-check the current challenge\n  reset                       restart the sandbox\n  next                        go to the next challenge\n  quit                        return to your practice machine\n  stats                       your progress');
                        return sub ? 1 : 0;
                }
            }, { builtin: true, virtual: true });
            LA.util.register('tutorial', (ctx) => {
                const sub = ctx.args[0] || 'start';
                const steps = LA.challenges.TUTORIAL;
                if (sub === 'reset' || (sub === 'start' && app.state.tutorialDone)) { app.state.tutorialStep = 0; app.state.tutorialDone = false; }
                if (sub === 'quit' || sub === 'stop') { app.tutorialActive = false; ctx.outln('Tutorial paused. Type "tutorial" to resume.'); return 0; }
                if (sub === 'status') { ctx.outln('Tutorial step ' + (app.state.tutorialStep + 1) + ' of ' + steps.length); return 0; }
                if (sub === 'skip' || sub === 'next') { app.state.tutorialStep = Math.min(steps.length - 1, app.state.tutorialStep + 1); }
                if (app.termChallenge) return ctx.fail('finish or quit the current challenge first (challenge quit)');
                app.tutorialActive = true;
                ctx.out(app.tutorialText());
                return 0;
            }, { builtin: true, virtual: true });
            LA.util.register('xp', (ctx) => {
                const st = app.state;
                ctx.outln(C.bgreen + 'Level ' + app.level() + C.reset + '  ' + st.xp + ' XP  (' + app.xpToNext() + ' XP to next level)');
                ctx.outln('Challenges: ' + Object.keys(st.completed).length + '/' + app.challenges.length + '   Achievements: ' + st.achievements.length + '/' + app.achievementDefs().length + '   Streak: ' + app.streak() + ' day(s)');
                ctx.outln('Commands run: ' + st.totalCommands + ' (' + app.accuracy() + '% successful)');
                return 0;
            }, { builtin: true, virtual: true });
            LA.commands.stats = LA.commands.xp;
            LA.util.register('about', (ctx) => {
                ctx.outln(C.bgreen + 'Linux Arsenal 2.0' + C.reset + ' - interactive Linux learning platform');
                ctx.outln('Developed by ' + C.bcyan + '0x0806' + C.reset);
                ctx.outln('Source: https://github.com/0x0806/Linux-Arsenal');
                return 0;
            }, { builtin: true, virtual: true });
            function diffColor(d) { return { beginner: C.green, intermediate: C.cyan, advanced: C.yellow, expert: C.red }[d] || ''; }
            // run pending terminal transitions after the command finished
            const origRun = LA.Terminal.prototype.execute;
            LA.Terminal.prototype.execute = function (src, opts) {
                origRun.call(this, src, opts);
                if (this !== app.terminal) return;
                if (app.pendingTerminalChallenge) { const c = app.pendingTerminalChallenge; app.pendingTerminalChallenge = null; app.startTerminalChallenge(c); }
                else if (app.pendingQuitChallenge) { app.pendingQuitChallenge = false; app.quitTerminalChallenge(); }
                else if (app.pendingFinish) { app.pendingFinish = false; app.finishTerminalChallenge(); }
            };
        }
        describeForTerminal(c) {
            const C = LA.util.C;
            return '\n' + C.bgreen + '━━ Challenge #' + (c.number || '?') + ' ━━ ' + C.reset + C.bold + c.title + C.reset + '\n' +
                C.gray + c.difficulty + ' · ' + c.category + ' · +' + c.xp + ' XP' + C.reset + '\n\n' + c.description + '\n\n' +
                C.gray + 'You are on an isolated sandbox machine. Commands: challenge hint | solution | reset | quit' + C.reset + '\n\n';
        }
        startTerminalChallenge(c) {
            const t = this.terminal;
            this.tutorialActive = false;
            this.termChallenge = new LA.challenges.ChallengeSession(c);
            t.setShell(this.termChallenge.shell, { history: t.history });
            t.write(this.describeForTerminal(c));
            t.renderPrompt();
            this.updateStatusBar();
        }
        quitTerminalChallenge(msg) {
            const t = this.terminal;
            this.termChallenge = null;
            t.setShell(this.machine, { history: t.history });
            t.writeln(msg || 'Back on your practice machine.');
            t.renderPrompt();
            this.updateStatusBar();
        }
        finishTerminalChallenge() {
            const s = this.termChallenge;
            const t = this.terminal;
            const C = LA.util.C;
            const gained = this.completeChallenge(s.challenge, s);
            t.writeln('\n' + C.bgreen + '✔ Challenge solved!' + C.reset + (gained ? ' +' + gained + ' XP' : ' (already completed before)') + '  time ' + fmtTime(s.elapsed) + ', ' + s.attempts + ' command(s).');
            t.writeln('Type ' + C.byellow + 'challenge next' + C.reset + ' for another one, or ' + C.byellow + 'challenge quit' + C.reset + ' to return to your machine.\n');
            t.renderPrompt();
        }
        nextChallengeAfter(c) {
            const idx = this.challenges.indexOf(c);
            for (let i = idx + 1; i < this.challenges.length; i++) if (!this.state.completed[this.challenges[i].id]) return this.challenges[i];
            return this.challenges.find((x) => !this.state.completed[x.id]) || null;
        }

        // ---------------------------------------------------------- tutorial
        tutorialText() {
            const steps = LA.challenges.TUTORIAL;
            const st = steps[this.state.tutorialStep];
            const C = LA.util.C;
            return '\n' + C.bcyan + 'Tutorial ' + (this.state.tutorialStep + 1) + '/' + steps.length + ': ' + st.title + C.reset + '\n' + st.text + '\n' + C.gray + '(example: ' + st.solution + '   |   tutorial skip / tutorial quit)' + C.reset + '\n\n';
        }
        tutorialCheck(info) {
            const steps = LA.challenges.TUTORIAL;
            const st = steps[this.state.tutorialStep];
            if (!st || /^\s*tutorial\b/.test(info.line)) return;
            let ok = false;
            try { ok = st.check(st, this.machine, info.stdout, info.execLog); } catch (e) { ok = false; }
            if (!ok) return;
            const t = this.terminal;
            this.addXp(10, null, true);
            if (st.final || this.state.tutorialStep >= steps.length - 1) {
                this.state.tutorialDone = true;
                this.tutorialActive = false;
                this.unlock('tutorial');
                t.writeln('\x1b[1;32m🎓 Tutorial complete! +10 XP\x1b[0m');
                return;
            }
            this.state.tutorialStep++;
            t.writeln('\x1b[1;32m✔ Nice! +10 XP\x1b[0m');
            t.write(this.tutorialText());
        }

        // ---------------------------------------------------------- XP / levels / streak
        level() { return Math.floor(Math.sqrt(this.state.xp / 50)) + 1; }
        xpForLevel(l) { return (l - 1) * (l - 1) * 50; }
        xpToNext() { return this.xpForLevel(this.level() + 1) - this.state.xp; }
        accuracy() { return this.state.totalCommands ? Math.round((this.state.okCommands / this.state.totalCommands) * 100) : 100; }
        day() { const d = today(); if (!this.state.activity[d]) this.state.activity[d] = { commands: 0, challenges: 0, seconds: 0, xp: 0 }; return this.state.activity[d]; }
        streak() {
            let n = 0;
            const d = new Date();
            if (!this.state.activity[today()]) d.setDate(d.getDate() - 1);
            for (;;) {
                const k = d.toISOString().slice(0, 10);
                if (!this.state.activity[k]) break;
                n++;
                d.setDate(d.getDate() - 1);
            }
            return n;
        }
        tickTime() {
            this.saveState();
        }
        addXp(n, reason, quiet) {
            const before = this.level();
            this.state.xp += n;
            this.day().xp = (this.day().xp || 0) + n;
            if (this.level() > before) { this.toast('🎉 Level up! You are now level ' + this.level(), 'success'); this.sound('level'); this.addFeed('fas fa-arrow-up', 'Reached level ' + this.level()); }
            else if (!quiet && reason) this.toast(reason, 'success');
            this.updateHeader();
        }
        completeChallenge(c, session) {
            if (this.state.completed[c.id]) return 0;
            let xp = c.xp;
            if (session.revealed) xp = Math.ceil(xp / 2);
            else if (session.hintsUsed) xp = Math.max(Math.ceil(xp / 2), xp - session.hintsUsed * Math.ceil(xp / 6));
            this.state.completed[c.id] = { at: Date.now(), xp, time: session.elapsed, hints: session.hintsUsed };
            this.day().challenges++;
            const sk = SKILL_OF_CATEGORY[c.category];
            if (sk) this.state.skills[sk] += Math.ceil(xp / 2);
            this.addXp(xp, null, true);
            this.toast('Challenge solved: ' + c.title + ' (+' + xp + ' XP)', 'success');
            this.sound('success');
            this.addFeed('fas fa-trophy', 'Solved "' + c.title + '" (+' + xp + ' XP)');
            this.checkAchievements();
            this.saveState();
            this.refreshChallengeCard(c);
            this.updateChallengeStats();
            return xp;
        }
        addFeed(icon, text) {
            this.state.feed.unshift({ icon, text, at: Date.now() });
            this.state.feed = this.state.feed.slice(0, 30);
            if (this.current === 'dashboard') this.renderFeed();
        }

        // ---------------------------------------------------------- achievements
        achievementDefs() {
            const st = this.state;
            const done = () => Object.keys(st.completed).length;
            const doneDiff = (d) => Object.keys(st.completed).filter((id) => { const c = this.byId.get(id); return c && c.difficulty === d; }).length;
            const doneCat = (cat) => Object.keys(st.completed).filter((id) => { const c = this.byId.get(id); return c && c.category === cat; }).length;
            const used = (n) => st.commandCounts[n] || 0;
            const distinct = () => Object.keys(st.commandCounts).length;
            if (!this._defs) this._defs = [
                ['first_command', 'First Steps', 'Run your first command', 'fas fa-shoe-prints', () => st.totalCommands >= 1],
                ['tutorial', 'Graduate', 'Finish the interactive tutorial', 'fas fa-graduation-cap', () => st.tutorialDone],
                ['explorer', 'Explorer', 'Use cd 10 times', 'fas fa-compass', () => used('cd') >= 10],
                ['reader', 'Bookworm', 'Read 10 files with cat or less', 'fas fa-book-open', () => used('cat') + used('less') >= 10],
                ['manual', 'RTFM', 'Open 5 manual pages', 'fas fa-book', () => used('man') >= 5],
                ['polyglot', 'Polyglot', 'Use 25 different commands', 'fas fa-language', () => distinct() >= 25],
                ['commander', 'Commander', 'Use 60 different commands', 'fas fa-terminal', () => distinct() >= 60],
                ['hundred', 'Centurion', 'Run 100 commands', 'fas fa-keyboard', () => st.totalCommands >= 100],
                ['thousand', 'Keyboard Warrior', 'Run 1000 commands', 'fas fa-fire-flame-curved', () => st.totalCommands >= 1000],
                ['grep_master', 'Pattern Hunter', 'Use grep 20 times', 'fas fa-magnifying-glass', () => used('grep') >= 20],
                ['awk_sed', 'Stream Wizard', 'Use both awk and sed', 'fas fa-wand-magic-sparkles', () => used('awk') && used('sed')],
                ['root', 'With Great Power', 'Use sudo', 'fas fa-user-shield', () => used('sudo') >= 1],
                ['editor', 'Editor Wars', 'Edit a file with nano or vim', 'fas fa-pen-to-square', () => used('nano') + used('vim') + used('vi') >= 1],
                ['git', 'Version Controlled', 'Run 10 git commands', 'fab fa-git-alt', () => used('git') >= 10],
                ['docker', 'Containerized', 'Run 10 docker commands', 'fab fa-docker', () => used('docker') >= 10],
                ['c1', 'Challenger', 'Solve your first challenge', 'fas fa-flag', () => done() >= 1],
                ['c10', 'Problem Solver', 'Solve 10 challenges', 'fas fa-star', () => done() >= 10],
                ['c50', 'Linux Guru', 'Solve 50 challenges', 'fas fa-user-ninja', () => done() >= 50],
                ['c100', 'Centurion of the Shell', 'Solve 100 challenges', 'fas fa-crown', () => done() >= 100],
                ['c500', 'Kernel Hacker', 'Solve 500 challenges', 'fas fa-microchip', () => done() >= 500],
                ['beginner10', 'Solid Foundation', 'Solve 10 beginner challenges', 'fas fa-seedling', () => doneDiff('beginner') >= 10],
                ['inter10', 'Intermediate Warrior', 'Solve 10 intermediate challenges', 'fas fa-shield-halved', () => doneDiff('intermediate') >= 10],
                ['adv5', 'Advanced Conqueror', 'Solve 5 advanced challenges', 'fas fa-mountain', () => doneDiff('advanced') >= 5],
                ['expert1', 'Expert', 'Solve an expert challenge', 'fas fa-dragon', () => doneDiff('expert') >= 1],
                ['security', 'Security Specialist', 'Solve 5 security or permissions challenges', 'fas fa-lock', () => doneCat('Security') + doneCat('Permissions') >= 5],
                ['network', 'Network Ninja', 'Solve 5 networking challenges', 'fas fa-network-wired', () => doneCat('Networking') >= 5],
                ['ctf', 'Flag Hunter', 'Capture a hidden flag', 'fas fa-flag-checkered', () => Object.keys(st.completed).some((id) => id.startsWith('ctf-'))],
                ['xp500', 'XP Hunter', 'Earn 500 XP', 'fas fa-coins', () => st.xp >= 500],
                ['xp2500', 'XP Master', 'Earn 2500 XP', 'fas fa-gem', () => st.xp >= 2500],
                ['level5', 'Level 5 Hero', 'Reach level 5', 'fas fa-medal', () => this.level() >= 5],
                ['level10', 'Level 10 Legend', 'Reach level 10', 'fas fa-trophy', () => this.level() >= 10],
                ['streak3', 'Three in a Row', 'Practice 3 days in a row', 'fas fa-fire', () => this.streak() >= 3],
                ['streak7', 'Week Warrior', 'Practice 7 days in a row', 'fas fa-calendar-check', () => this.streak() >= 7],
                ['nohints', 'No Help Needed', 'Solve 10 challenges without hints', 'fas fa-brain', () => Object.values(st.completed).filter((x) => !x.hints).length >= 10],
                ['fun', 'Easter Egg', 'Make a cow talk or watch a train', 'fas fa-egg', () => used('cowsay') + used('sl') + used('cmatrix') >= 1]
            ].map(([id, name, description, icon, condition]) => ({ id, name, description, icon, condition }));
            return this._defs;
        }
        checkAchievements() {
            for (const a of this.achievementDefs()) {
                if (this.state.achievements.includes(a.id)) continue;
                let ok = false;
                try { ok = a.condition(); } catch (e) { ok = false; }
                if (ok) this.unlock(a.id);
            }
        }
        unlock(id) {
            if (this.state.achievements.includes(id)) return;
            const a = this.achievementDefs().find((x) => x.id === id);
            if (!a) return;
            this.state.achievements.push(id);
            this.toast('🏅 Achievement unlocked: ' + a.name, 'success');
            this.addFeed('fas fa-medal', 'Unlocked "' + a.name + '"');
            this.addXp(25, null, true);
            this.saveState();
            if (this.current === 'achievements') this.renderAchievements();
        }

        // ---------------------------------------------------------- UI binding
        bindUI() {
            document.querySelectorAll('.nav-btn').forEach((b) => b.addEventListener('click', () => this.switchSection(b.dataset.section)));
            $('clear-terminal').addEventListener('click', () => { this.terminal.clear(); this.terminal.renderPrompt(); this.terminal.focus(); });
            $('terminal-help').addEventListener('click', () => this.terminal.run('help'));
            $('reset-machine').addEventListener('click', () => {
                if (!confirm('Reset your practice machine? All files you created on it will be lost.')) return;
                storage.del(FS_KEY);
                this.machine = LA.createMachine();
                this.machine.history = this.terminal.history;
                if (!this.termChallenge) this.terminal.setShell(this.machine, { clear: true, banner: this.banner(), history: this.terminal.history });
                this.toast('Practice machine reset', 'info');
            });
            $('fullscreen-terminal').addEventListener('click', () => {
                const el = document.querySelector('.terminal-main');
                el.classList.toggle('fullscreen');
                this.terminal.fit();
                this.terminal.focus();
            });
            // challenges
            document.querySelectorAll('.filter-btn').forEach((b) => b.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach((x) => x.classList.remove('active'));
                b.classList.add('active');
                this.filters.difficulty = b.dataset.filter;
                this.renderChallenges(true);
            }));
            let searchTimer;
            $('challenge-search').addEventListener('input', (e) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { this.filters.search = e.target.value.trim().toLowerCase(); this.renderChallenges(true); }, 150); });
            $('category-filter').addEventListener('change', (e) => { this.filters.category = e.target.value; this.renderChallenges(true); });
            $('status-filter').addEventListener('change', (e) => { this.filters.status = e.target.value; this.renderChallenges(true); });
            $('load-more-challenges').addEventListener('click', () => this.renderChallenges(false));
            $('generate-challenge').addEventListener('click', () => this.generateChallenge());
            $('challenges-grid').addEventListener('click', (e) => {
                const card = e.target.closest('.challenge-card');
                if (card) this.openChallenge(card.dataset.challengeId);
            });
            $('challenges-grid').addEventListener('keydown', (e) => {
                const card = e.target.closest('.challenge-card');
                if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.openChallenge(card.dataset.challengeId); }
            });
            // modal
            $('close-challenge').addEventListener('click', () => this.closeChallenge());
            $('challenge-modal').addEventListener('mousedown', (e) => { if (e.target.id === 'challenge-modal') this.closeChallenge(); });
            $('show-hint').addEventListener('click', () => this.showHint());
            $('show-solution').addEventListener('click', () => this.showSolution());
            $('reset-challenge').addEventListener('click', () => this.resetChallenge());
            $('next-challenge').addEventListener('click', () => { const c = this.session && this.nextChallengeAfter(this.session.challenge); if (c) this.openChallenge(c.id); });
            document.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape') return;
                if (!$('settings-modal').classList.contains('hidden')) { this.closeSettings(); return; }
                if (!$('challenge-modal').classList.contains('hidden') && !(this.modalTerm && this.modalTerm.app)) this.closeChallenge();
            });
            // dashboard quick actions
            document.querySelectorAll('.action-btn').forEach((b) => b.addEventListener('click', () => this.quickAction(b.dataset.action)));
            // leaderboard period
            document.querySelectorAll('.period-btn').forEach((b) => b.addEventListener('click', () => {
                document.querySelectorAll('.period-btn').forEach((x) => x.classList.remove('active'));
                b.classList.add('active');
                this.renderLeaderboard(b.dataset.period);
            }));
            // assistant
            $('toggle-assistant').addEventListener('click', () => this.toggleAssistant());
            $('minimize-assistant').addEventListener('click', () => $('ai-assistant').classList.toggle('minimized'));
            document.querySelector('.assistant-header').addEventListener('dblclick', () => this.toggleAssistant());
            $('send-message').addEventListener('click', () => this.sendChat());
            $('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.sendChat(); });
            $('chat-messages').addEventListener('click', (e) => {
                const b = e.target.closest('.suggestion-btn');
                if (b) { $('chat-input').value = b.dataset.suggestion; this.sendChat(); }
                const run = e.target.closest('.run-cmd');
                if (run) { this.switchSection('terminal'); this.terminal.run(run.dataset.cmd); }
            });
            this.toggleAssistant(false);
            // settings
            $('open-settings').addEventListener('click', () => this.openSettings());
            $('close-settings').addEventListener('click', () => this.closeSettings());
            $('settings-modal').addEventListener('mousedown', (e) => { if (e.target.id === 'settings-modal') this.closeSettings(); });
            const s = this.state.settings;
            $('theme-select').value = s.theme;
            $('terminal-font-size').value = s.fontSize;
            $('cursor-style').value = s.cursor;
            $('cursor-blink').checked = s.blink;
            $('auto-hints').checked = s.autoHints;
            $('sound-effects').checked = s.sound;
            const upd = () => {
                s.theme = $('theme-select').value; s.fontSize = parseInt($('terminal-font-size').value, 10); s.cursor = $('cursor-style').value;
                s.blink = $('cursor-blink').checked; s.autoHints = $('auto-hints').checked; s.sound = $('sound-effects').checked;
                this.applySettings();
                this.saveState();
            };
            for (const id of ['theme-select', 'cursor-style', 'cursor-blink', 'auto-hints', 'sound-effects']) $(id).addEventListener('change', upd);
            $('terminal-font-size').addEventListener('input', upd);
            $('export-progress').addEventListener('click', () => {
                const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'linux-arsenal-progress-' + today() + '.json';
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            });
            $('reset-progress').addEventListener('click', () => {
                if (!confirm('Delete ALL progress (XP, challenges, achievements, practice machine)?')) return;
                storage.del(STORE_KEY); storage.del(FS_KEY);
                location.reload();
            });
            $('retry-button').addEventListener('click', () => location.reload());
            document.querySelectorAll('.stat-card, .challenge-stat').forEach((el) => el.setAttribute('tabindex', '-1'));
        }
        applySettings() {
            const s = this.state.settings;
            document.documentElement.style.setProperty('--term-font-size', s.fontSize + 'px');
            $('font-size-value').textContent = s.fontSize + 'px';
            for (const el of document.querySelectorAll('.la-term')) {
                el.dataset.theme = s.theme;
                el.dataset.cursor = s.cursor;
                el.classList.toggle('no-blink', !s.blink);
            }
            for (const t of [this.terminal, this.modalTerm]) if (t) t.fit();
        }
        openSettings() { $('settings-modal').classList.remove('hidden'); $('theme-select').focus(); }
        closeSettings() { $('settings-modal').classList.add('hidden'); }

        switchSection(section) {
            document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.section === section));
            document.querySelectorAll('.content-section').forEach((s) => s.classList.toggle('active', s.id === section + '-section'));
            this.current = section;
            if (section === 'dashboard') this.renderDashboard();
            if (section === 'terminal') { setTimeout(() => { this.terminal.fit(); this.terminal.focus(); this.terminal.scrollToBottom(); }, 30); }
            if (section === 'challenges') { if (!this.shown) this.renderChallenges(true); this.updateChallengeStats(); }
            if (section === 'achievements') this.renderAchievements();
            if (section === 'leaderboard') this.renderLeaderboard('all');
            if (section === 'analytics') this.renderAnalytics();
        }
        quickAction(a) {
            if (a === 'start-challenge') {
                const c = this.challenges.find((x) => !this.state.completed[x.id]) || this.challenges[0];
                this.switchSection('challenges');
                this.openChallenge(c.id);
            } else if (a === 'practice-mode') {
                this.switchSection('terminal');
                if (!this.state.tutorialDone && !this.termChallenge) this.terminal.run('tutorial');
            } else if (a === 'daily-goal') {
                const d = this.day();
                const goal = 3;
                this.toast(d.challenges >= goal ? '✅ Daily goal reached: ' + d.challenges + ' challenges solved today!' : '🎯 Daily goal: solve ' + goal + ' challenges. Today: ' + d.challenges + '/' + goal, d.challenges >= goal ? 'success' : 'info');
            } else if (a === 'random-tip') {
                const tips = ['Press Tab twice to see all completions.', 'Ctrl+R searches your command history.', '!! repeats the last command; sudo !! repeats it as root.', 'Use "cd -" to jump back to the previous directory.', 'Pipe anything into less to scroll through it.', 'man -k KEYWORD finds commands by topic.', 'Ctrl+A / Ctrl+E jump to the start / end of the line.', 'Quote globs given to find: find . -name "*.txt".', '2>/dev/null hides error messages.', 'Use && to run the next command only if the previous one succeeded.', 'history | grep ssh finds that command you typed last week.', 'tldr CMD shows practical examples quickly.', 'Alt+. inserts the last argument of the previous command.'];
                this.toast('💡 ' + tips[Math.floor(Math.random() * tips.length)], 'info');
            }
        }

        // ---------------------------------------------------------- rendering
        renderAll() {
            this.updateHeader();
            this.renderDashboard();
            this.renderQuickRef();
            this.updateHistoryPanel();
            $('typing-speed').textContent = this.state.totalCommands;
            $('command-accuracy').textContent = this.accuracy() + '%';
            $('total-achievements').textContent = this.achievementDefs().length;
            this.checkAchievements();
        }
        updateHeader() {
            $('user-xp').textContent = this.state.xp;
            $('user-level').textContent = this.level();
            $('header-streak').textContent = this.streak();
        }
        renderDashboard() {
            const st = this.state;
            $('streak-count').textContent = this.streak();
            $('commands-learned').textContent = Object.keys(st.commandCounts).length;
            const secs = Object.values(st.activity).reduce((a, d) => a + (d.seconds || 0), 0);
            $('time-spent').textContent = secs >= 3600 ? (secs / 3600).toFixed(1) + 'h' : Math.round(secs / 60) + 'm';
            $('accuracy-rate').textContent = this.accuracy() + '%';
            const trends = document.querySelectorAll('.stat-trend span');
            const week = this.lastDays(7);
            const sum = (k) => week.reduce((a, d) => a + ((st.activity[d] || {})[k] || 0), 0);
            if (trends.length >= 4) {
                trends[0].textContent = 'best: ' + Math.max(this.streak(), 0) + ' days';
                trends[1].textContent = sum('commands') + ' commands this week';
                trends[2].textContent = Math.round(sum('seconds') / 60) + ' min this week';
                trends[3].textContent = st.okCommands + ' / ' + st.totalCommands + ' ok';
            }
            for (const [skill, pts] of Object.entries(st.skills)) {
                const lvl = Math.floor(pts / 100) + 1, pct = pts % 100;
                const fill = document.querySelector('.progress-fill[data-skill="' + skill + '"]');
                const label = document.querySelector('.skill-level[data-skill="' + skill + '"]');
                if (fill) { fill.style.width = pct + '%'; const pc = fill.closest('.progress-bar-container').querySelector('.progress-percentage'); if (pc) pc.textContent = pct + '%'; }
                if (label) label.textContent = 'Level ' + lvl;
            }
            const banner = document.querySelector('.welcome-banner h2');
            if (banner) banner.textContent = st.totalCommands ? 'Welcome back, Linux Warrior! (Level ' + this.level() + ')' : 'Welcome to Linux Arsenal!';
            const sub = document.querySelector('.welcome-banner p');
            if (sub) sub.textContent = Object.keys(st.completed).length + ' of ' + this.challenges.length + ' challenges solved · ' + this.xpToNext() + ' XP to level ' + (this.level() + 1);
            this.renderFeed();
        }
        renderFeed() {
            const list = $('activity-list');
            const feed = this.state.feed.length ? this.state.feed : [{ icon: 'fas fa-play-circle', text: 'Welcome to Linux Arsenal! Open the terminal and type "tutorial" to start.', at: Date.now() }];
            list.innerHTML = feed.slice(0, 8).map((f) => '<div class="activity-item"><i class="' + esc(f.icon) + '"></i><div class="activity-content"><span class="activity-text">' + esc(f.text) + '</span><span class="activity-time">' + esc(timeAgo(f.at)) + '</span></div></div>').join('');
        }
        renderQuickRef() {
            const items = [['ls -la', 'list all files'], ['cd ~', 'go home'], ['cat FILE', 'print a file'], ['grep -rn TEXT .', 'search text'], ['find . -name "*.log"', 'find files'], ['cmd1 | cmd2', 'pipe'], ['cmd > file', 'redirect'], ['chmod +x FILE', 'make executable'], ['sudo CMD', 'run as root'], ['ps aux', 'processes'], ['man CMD', 'manual'], ['challenge random', 'play']];
            $('quick-ref').innerHTML = items.map(([c, d]) => '<button class="ref-item" data-cmd="' + esc(c) + '" title="Insert into terminal"><code>' + esc(c) + '</code><span>' + esc(d) + '</span></button>').join('');
            $('quick-ref').addEventListener('click', (e) => {
                const b = e.target.closest('.ref-item');
                if (!b) return;
                const t = this.terminal;
                t.buffer = b.dataset.cmd; t.cursor = t.buffer.length; t.renderInput(); t.focus();
            });
        }
        updateHistoryPanel() {
            const h = (this.terminal ? this.terminal.history : this.state.history || []).slice(-12).reverse();
            const el = $('history-content');
            el.innerHTML = h.length ? h.map((c) => '<div class="history-item" data-cmd="' + esc(c) + '" title="Click to insert">' + esc(c) + '</div>').join('') : '<div class="history-item">No commands yet</div>';
            if (!el.dataset.bound) {
                el.dataset.bound = '1';
                el.addEventListener('click', (e) => { const it = e.target.closest('.history-item'); if (it && it.dataset.cmd) { const t = this.terminal; t.buffer = it.dataset.cmd; t.cursor = t.buffer.length; t.renderInput(); t.focus(); } });
            }
        }
        updateHint(cmd) {
            const d = cmd && LA.docs.get(cmd);
            const el = $('hint-content');
            if (d && !d.generated && d.examples.length) {
                const ex = d.examples[Math.floor(Math.random() * d.examples.length)];
                el.innerHTML = '<strong>' + esc(cmd) + '</strong> - ' + esc(d.summary) + '<br><code>' + esc(ex[0]) + '</code><br><span class="muted">' + esc(ex[1]) + '</span>';
            }
        }

        // ---------------------------------------------------------- challenges list
        populateCategoryFilter() {
            const cats = Array.from(new Set(this.challenges.map((c) => c.category))).sort();
            $('category-filter').innerHTML = '<option value="all">All categories</option>' + cats.map((c) => '<option value="' + esc(c) + '">' + esc(c) + ' (' + this.challenges.filter((x) => x.category === c).length + ')</option>').join('');
        }
        filtered() {
            const f = this.filters;
            return this.challenges.filter((c) => {
                if (f.difficulty !== 'all' && c.difficulty !== f.difficulty) return false;
                if (f.category !== 'all' && c.category !== f.category) return false;
                if (f.status === 'done' && !this.state.completed[c.id]) return false;
                if (f.status === 'todo' && this.state.completed[c.id]) return false;
                if (f.search) {
                    const hay = (c.title + ' ' + c.description + ' ' + c.category + ' ' + c.difficulty + ' #' + c.number).toLowerCase();
                    if (!f.search.split(/\s+/).every((w) => hay.includes(w))) return false;
                }
                return true;
            });
        }
        cardHtml(c) {
            const done = this.state.completed[c.id];
            return '<div class="challenge-card ' + (done ? 'completed' : '') + '" data-challenge-id="' + esc(c.id) + '" tabindex="0" role="button" aria-label="' + esc(c.title) + '">' +
                '<div class="challenge-header"><div class="challenge-title">' + (c.number ? '<span class="challenge-num">#' + c.number + '</span> ' : '<span class="challenge-num">new</span> ') + esc(c.title) + '</div>' +
                '<div class="challenge-difficulty difficulty-' + esc(c.difficulty) + '">' + esc(c.difficulty) + '</div></div>' +
                '<div class="challenge-description">' + esc(c.description) + '</div>' +
                '<div class="challenge-meta"><div class="challenge-category">' + esc(c.category) + '</div><div class="challenge-xp">' + (done ? '<i class="fas fa-check"></i> ' + done.xp + ' XP' : '+' + c.xp + ' XP') + '</div></div></div>';
        }
        renderChallenges(reset) {
            const list = this.filtered();
            const grid = $('challenges-grid');
            if (reset) { this.shown = 0; grid.innerHTML = ''; }
            const next = list.slice(this.shown, this.shown + this.pageSize);
            grid.insertAdjacentHTML('beforeend', next.map((c) => this.cardHtml(c)).join(''));
            this.shown += next.length;
            if (!list.length) grid.innerHTML = '<div class="empty-state"><i class="fas fa-filter"></i> No challenges match these filters.</div>';
            $('challenges-showing').textContent = list.length ? 'Showing ' + this.shown + ' of ' + list.length + ' challenges' : '';
            $('load-more-challenges').style.display = this.shown < list.length ? '' : 'none';
            this.updateChallengeStats();
        }
        refreshChallengeCard(c) {
            const card = document.querySelector('.challenge-card[data-challenge-id="' + CSS.escape(c.id) + '"]');
            if (card) card.outerHTML = this.cardHtml(c);
        }
        updateChallengeStats() {
            const total = this.challenges.length;
            const done = Object.keys(this.state.completed).filter((id) => this.byId.has(id)).length;
            $('total-challenges').textContent = total;
            $('completed-challenges').textContent = done;
            $('success-rate').textContent = (total ? ((done / total) * 100).toFixed(done && done / total < 0.1 ? 1 : 0) : 0) + '%';
        }
        generateChallenge() {
            const diff = this.filters.difficulty !== 'all' ? this.filters.difficulty : undefined;
            const cat = this.filters.category !== 'all' ? this.filters.category : undefined;
            const seed = Math.floor(Math.random() * 1e9);
            const c = LA.challenges.generateRandom(seed, { difficulty: diff, category: cat });
            this.challenges.unshift(c);
            this.byId.set(c.id, c);
            this.state.generated.push(c.id);
            this.state.generated = this.state.generated.slice(-200);
            this.saveState();
            this.populateCategoryFilter();
            $('category-filter').value = this.filters.category;
            this.renderChallenges(true);
            this.toast('New challenge generated: ' + c.title, 'success');
            this.openChallenge(c.id);
        }

        // ---------------------------------------------------------- challenge modal
        openChallenge(id) {
            const c = this.byId.get(id);
            if (!c) return;
            this.session = new LA.challenges.ChallengeSession(c);
            const done = this.state.completed[c.id];
            $('challenge-title').textContent = (c.number ? '#' + c.number + ' ' : '') + c.title;
            $('challenge-description').innerHTML =
                '<p class="challenge-task">' + esc(c.description) + '</p>' +
                '<div class="challenge-tags"><span class="challenge-difficulty difficulty-' + esc(c.difficulty) + '">' + esc(c.difficulty) + '</span><span class="tag">' + esc(c.category) + '</span><span class="tag xp">+' + c.xp + ' XP</span>' + (done ? '<span class="tag done"><i class="fas fa-check"></i> completed</span>' : '') + '</div>' +
                '<p class="challenge-note"><i class="fas fa-shield-halved"></i> This terminal is a fresh, isolated machine. Solve the task any way you like &mdash; it is checked automatically after every command.</p>';
            $('hint-display').classList.add('hidden');
            $('hint-display').innerHTML = '';
            $('challenge-result').classList.add('hidden');
            $('challenge-attempts').textContent = 'Commands: 0';
            $('challenge-modal').classList.remove('hidden');
            const host = $('challenge-terminal-host');
            if (!this.modalTerm) {
                this.modalTerm = new LA.Terminal(host, {
                    onCommand: (line, info) => this.onModalCommand(line, info),
                    onAppClose: () => { if (this.session && !this.session.solved && this.session.recheck()) this.onChallengeSolved(); }
                });
                this.applySettings();
            }
            this.modalTerm.setShell(this.session.shell, { clear: true, history: [] });
            this.modalTerm.writeln('\x1b[90m# ' + c.title + ' - type your commands below (Tab completes, man/tldr work here too)\x1b[0m');
            this.modalTerm.renderPrompt();
            clearInterval(this.timer);
            this.timer = setInterval(() => { if (this.session) $('challenge-time').textContent = fmtTime(this.session.elapsed); }, 500);
            $('challenge-time').textContent = '00:00';
            setTimeout(() => { this.modalTerm.fit(); this.modalTerm.focus(); }, 50);
        }
        onModalCommand(line, info) {
            const s = this.session;
            if (!s) return;
            this.trackCommand(info);
            const solved = s.solved || s.afterCommand(info.stdout, info.cwdBefore);
            $('challenge-attempts').textContent = 'Commands: ' + s.attempts;
            if (solved && !s.celebrated) this.onChallengeSolved();
            else if (!solved && this.state.settings.autoHints && s.attempts === 5 && !s.hintsUsed) {
                $('hint-display').classList.remove('hidden');
                $('hint-display').innerHTML = '<i class="fas fa-lightbulb"></i> Stuck? Press <strong>Hint</strong> for a nudge.';
            }
        }
        onChallengeSolved() {
            const s = this.session;
            s.celebrated = true;
            const gained = this.completeChallenge(s.challenge, s);
            const r = $('challenge-result');
            r.classList.remove('hidden');
            r.innerHTML = '<div class="result-title"><i class="fas fa-circle-check"></i> Challenge solved!</div><div>' + (gained ? '+' + gained + ' XP' : 'Already completed earlier - no extra XP') + ' · ' + fmtTime(s.elapsed) + ' · ' + s.attempts + ' command' + (s.attempts === 1 ? '' : 's') + (s.hintsUsed ? ' · ' + s.hintsUsed + ' hint' + (s.hintsUsed > 1 ? 's' : '') : '') + '</div>' +
                '<div class="result-solution">Reference solution: <code>' + esc(s.challenge.solution) + '</code></div>';
            this.modalTerm.writeln('\x1b[1;32m✔ Solved! Press "Next challenge" or keep exploring this sandbox.\x1b[0m');
            this.modalTerm.renderPrompt();
            this.confetti();
        }
        showHint() {
            if (!this.session) return;
            const h = this.session.nextHint();
            const el = $('hint-display');
            el.classList.remove('hidden');
            const all = this.session.challenge.hints.slice(0, this.session.hintsUsed);
            el.innerHTML = all.map((x, i) => '<div class="hint-line"><strong>Hint ' + (i + 1) + ':</strong> ' + esc(x) + '</div>').join('') || esc(h || 'No hints available.');
            this.modalTerm.focus();
        }
        showSolution() {
            if (!this.session) return;
            if (!this.session.solved && !this.session.revealed && !confirm('Reveal the solution? You will only earn half the XP for this challenge.')) return;
            this.session.revealed = true;
            const el = $('hint-display');
            el.classList.remove('hidden');
            el.innerHTML = '<div class="hint-line"><strong>Solution:</strong> <code>' + esc(this.session.challenge.solution) + '</code> <button class="hint-button secondary small" id="type-solution">Type it for me</button></div>';
            $('type-solution').addEventListener('click', () => { const t = this.modalTerm; t.buffer = this.session.challenge.solution.split('\n')[0]; t.cursor = t.buffer.length; t.renderInput(); t.focus(); });
        }
        resetChallenge() {
            if (!this.session) return;
            const c = this.session.challenge;
            const keep = { hintsUsed: this.session.hintsUsed, revealed: this.session.revealed };
            this.openChallenge(c.id);
            Object.assign(this.session, keep);
            this.modalTerm.writeln('\x1b[33mSandbox reset to its initial state.\x1b[0m');
            this.modalTerm.renderPrompt();
        }
        closeChallenge() {
            $('challenge-modal').classList.add('hidden');
            clearInterval(this.timer);
            if (this.modalTerm && this.modalTerm.app) this.modalTerm.closeApp();
            this.session = null;
        }

        // ---------------------------------------------------------- achievements / leaderboard / analytics
        renderAchievements() {
            const defs = this.achievementDefs();
            $('unlocked-count').textContent = this.state.achievements.length;
            $('total-achievements').textContent = defs.length;
            $('achievements-grid').innerHTML = defs.map((a) => {
                const ok = this.state.achievements.includes(a.id);
                return '<div class="achievement-card ' + (ok ? 'unlocked' : '') + '"><div class="achievement-icon"><i class="' + esc(a.icon) + '"></i></div><div class="achievement-name">' + esc(a.name) + '</div><div class="achievement-description">' + esc(a.description) + '</div></div>';
            }).join('');
        }
        renderLeaderboard(period) {
            const factor = period === 'weekly' ? 0.12 : period === 'monthly' ? 0.4 : 1;
            const bots = [['LinuxNinja', 9450, 34, 310], ['TerminalMaster', 7120, 21, 240], ['CommandGuru', 5310, 12, 180], ['BashExpert', 3880, 9, 133], ['ShellWizard', 2410, 6, 88], ['GrepGoblin', 1320, 4, 51], ['SudoSam', 640, 2, 24], ['NewbieNick', 120, 1, 5]];
            const week = this.lastDays(period === 'weekly' ? 7 : 30).reduce((a, d) => a + ((this.state.activity[d] || {}).xp || 0), 0);
            const myXp = period === 'all' ? this.state.xp : week;
            const rows = bots.map(([n, xp, s, c]) => ({ name: n, xp: Math.round(xp * factor), streak: s, challenges: Math.round(c * factor), me: false }));
            rows.push({ name: 'You', xp: myXp, streak: this.streak(), challenges: Object.keys(this.state.completed).length, me: true });
            rows.sort((a, b) => b.xp - a.xp);
            $('leaderboard-list').innerHTML = rows.map((r, i) => '<div class="leaderboard-entry ' + (r.me ? 'current-user' : '') + '"><div class="entry-rank ' + (i < 3 ? 'top-3' : '') + '">' + (i < 3 ? ['🥇', '🥈', '🥉'][i] : '#' + (i + 1)) + '</div><div class="entry-user">' + esc(r.name) + '</div><div class="entry-level">' + (Math.floor(Math.sqrt(r.xp / 50)) + 1) + '</div><div class="entry-xp">' + r.xp + '</div><div class="entry-streak">' + r.streak + '</div><div class="entry-challenges">' + r.challenges + '</div></div>').join('') +
                '<p class="leaderboard-note">Other players are simulated - your own stats are real and stored only in this browser.</p>';
        }
        lastDays(n) {
            const out = [];
            const d = new Date();
            for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); out.push(x.toISOString().slice(0, 10)); }
            return out;
        }
        renderAnalytics() {
            const st = this.state;
            const days = this.lastDays(14);
            const bars = (key, fmt) => {
                const vals = days.map((d) => (st.activity[d] || {})[key] || 0);
                const max = Math.max(1, ...vals);
                return '<div class="bar-chart">' + vals.map((v, i) => '<div class="bar-col" title="' + days[i] + ': ' + fmt(v) + '"><div class="bar" style="height:' + Math.max(2, (v / max) * 100) + '%"></div><span>' + days[i].slice(8) + '</span></div>').join('') + '</div>';
            };
            $('time-chart').innerHTML = '<div class="chart-caption">Minutes practiced, last 14 days</div>' + bars('seconds', (v) => Math.round(v / 60) + ' min');
            const catDone = {};
            for (const id of Object.keys(st.completed)) { const c = this.byId.get(id); if (c) catDone[c.category] = (catDone[c.category] || 0) + 1; }
            const cats = Array.from(new Set(this.challenges.map((c) => c.category))).sort();
            $('accuracy-chart').innerHTML = '<div class="chart-caption">Challenges solved by category · command success rate ' + this.accuracy() + '%</div>' + cats.map((c) => {
                const tot = this.challenges.filter((x) => x.category === c).length;
                const n = catDone[c] || 0;
                return '<div class="command-freq-item"><span class="command">' + esc(c) + '</span><div class="freq-bar"><div class="freq-fill" style="width:' + (n / tot) * 100 + '%"></div></div><span class="freq-count">' + n + '/' + tot + '</span></div>';
            }).join('');
            const top = Object.entries(st.commandCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
            const max = top.length ? top[0][1] : 1;
            $('command-frequency').innerHTML = top.length ? top.map(([c, n]) => '<div class="command-freq-item"><span class="command">' + esc(c) + '</span><div class="freq-bar"><div class="freq-fill" style="width:' + (n / max) * 100 + '%"></div></div><span class="freq-count">' + n + '</span></div>').join('') : '<div class="chart-placeholder">Run some commands in the terminal to see statistics.</div>';
            const cal = this.lastDays(84);
            const maxC = Math.max(1, ...cal.map((d) => (st.activity[d] || {}).commands || 0));
            $('streak-calendar').innerHTML = '<div class="chart-caption">Activity over the last 12 weeks · current streak ' + this.streak() + ' day(s)</div><div class="heatmap">' + cal.map((d) => {
                const v = (st.activity[d] || {}).commands || 0;
                const lvl = v ? Math.min(4, Math.ceil((v / maxC) * 4)) : 0;
                return '<div class="heat heat-' + lvl + '" title="' + d + ': ' + v + ' commands"></div>';
            }).join('') + '</div>';
        }

        // ---------------------------------------------------------- assistant (offline, knowledge-based)
        toggleAssistant(force) {
            const a = $('ai-assistant');
            const collapsed = force === undefined ? !a.classList.contains('collapsed') : !force;
            a.classList.toggle('collapsed', collapsed);
            $('toggle-assistant').innerHTML = collapsed ? '<i class="fas fa-chevron-up"></i>' : '<i class="fas fa-chevron-down"></i>';
        }
        sendChat() {
            const input = $('chat-input');
            const msg = input.value.trim();
            if (!msg) return;
            input.value = '';
            this.addChat(esc(msg), 'user');
            const typing = this.addChat('<span class="typing">…</span>', 'assistant');
            setTimeout(() => { typing.querySelector('.message-content').innerHTML = this.answer(msg); $('chat-messages').scrollTop = 1e9; }, 350);
        }
        addChat(html, who) {
            const div = document.createElement('div');
            div.className = who + '-message';
            div.innerHTML = '<div class="message-avatar"><i class="fas fa-' + (who === 'user' ? 'user' : 'robot') + '"></i></div><div class="message-content">' + html + '</div>';
            $('chat-messages').appendChild(div);
            $('chat-messages').scrollTop = 1e9;
            return div;
        }
        answer(q) {
            const lower = q.toLowerCase();
            const docs = LA.docs;
            const runBtn = (c) => '<button class="run-cmd" data-cmd="' + esc(c) + '" title="Run in terminal"><code>' + esc(c) + '</code> <i class="fas fa-play"></i></button>';
            const words = lower.replace(/[^a-z0-9_.\-\s]/g, ' ').split(/\s+/).filter(Boolean);
            const cmd = words.find((w) => docs.all[w] || (docs.ALIASES[w] && docs.all[docs.ALIASES[w]]));
            const topics = [
                [/permission|chmod|rwx|octal/, 'Permissions are three groups (owner, group, others) of r=4, w=2, x=1. 755 = rwxr-xr-x, 644 = rw-r--r--, 600 = rw-------.', ['ls -l', 'chmod 644 notes.txt', 'chmod +x script.sh']],
                [/pipe|\|/, 'A pipe (|) sends the output of one command into the input of the next.', ['ls | wc -l', 'cat data/fruits.txt | sort | uniq -c', 'ps aux | grep nginx']],
                [/redirect|>|output to file|save output/, '> writes output to a file (overwrite), >> appends, < reads input from a file, 2> redirects errors, &> both.', ['echo hi > out.txt', 'ls /nope 2> errors.log', 'sort < data/numbers.txt']],
                [/process|kill|pid|cpu/, 'ps lists processes, top/htop show them live, kill PID stops one, pkill NAME stops by name.', ['ps aux --sort=-%cpu | head', 'pgrep -a python', 'kill 2187']],
                [/user|group|sudo|root/, 'Users and groups control access. sudo runs a command as root. Manage accounts with useradd, usermod -aG, passwd.', ['id', 'sudo whoami', 'groups']],
                [/service|systemctl|daemon|start|stop/, 'Services are managed by systemd: systemctl status|start|stop|restart|enable NAME (changing needs sudo).', ['systemctl status nginx', 'systemctl list-units --type=service']],
                [/network|ip|ping|port|dns|curl/, 'Networking: ip a (addresses), ping (reachability), ss -tuln (listening ports), dig (DNS), curl/wget (HTTP).', ['ip -br a', 'ping -c 3 google.com', 'ss -tuln', 'curl -I https://example.com']],
                [/find|search file|locate/, 'find walks the tree: find PATH -name "PATTERN" -type f -size +1M -mtime -7 ...', ['find . -name "*.txt"', 'find /var/log -size +1k']],
                [/archive|tar|zip|compress/, 'tar -czf ARCHIVE.tar.gz DIR creates, tar -tzf lists, tar -xzf extracts. gzip/gunzip compress single files.', ['tar -czf docs.tgz documents', 'tar -tzf docs.tgz']],
                [/script|loop|bash|variable|if /, 'Bash scripts start with #!/bin/bash. Variables: NAME=value, use $NAME. Loops: for i in 1 2 3; do echo $i; done. Make executable with chmod +x.', ['for i in $(seq 3); do echo $i; done', 'cat scripts/hello.sh', './scripts/hello.sh Linux']],
                [/git|commit|branch/, 'git init, git add ., git commit -m "msg", git log --oneline, git switch -c BRANCH, git merge BRANCH.', ['git init demo', 'git status']],
                [/docker|container|image/, 'docker run -d --name web -p 8080:80 nginx starts a web server; docker ps lists containers; docker logs/stop/rm manage them.', ['docker run hello-world', 'docker ps -a']],
                [/challenge|stuck|hint/, 'In a challenge, press Hint for progressive hints. Every challenge is checked by the result, so any approach that achieves the goal counts. In the terminal you can also type "challenge random".', ['challenge random beginner', 'challenge list']],
                [/learn|start|begin|new/, 'Start with the guided tutorial, then try beginner challenges. Learn navigation (pwd ls cd), files (cp mv rm), text (cat grep sort), then pipes, permissions and processes.', ['tutorial', 'help']],
                [/progress|level|xp|stat/, 'You are level ' + this.level() + ' with ' + this.state.xp + ' XP and ' + Object.keys(this.state.completed).length + ' solved challenges.', ['xp']]
            ];
            if (cmd) {
                const d = docs.get(cmd);
                let html = '<strong>' + esc(cmd) + '</strong> &mdash; ' + esc(d.summary) + '<br><small>' + esc(d.description) + '</small>';
                if (d.options.length) html += '<div class="chat-opts">' + d.options.slice(0, 5).map(([f, x]) => '<div><code>' + esc(f) + '</code> ' + esc(x) + '</div>').join('') + '</div>';
                if (d.examples.length) html += '<div class="chat-examples">' + d.examples.slice(0, 4).map(([c]) => runBtn(c)).join('') + '</div>';
                html += '<small>Full manual: ' + runBtn('man ' + cmd) + '</small>';
                return html;
            }
            for (const [re, text, ex] of topics) if (re.test(lower)) return esc(text) + '<div class="chat-examples">' + ex.map(runBtn).join('') + '</div>';
            const hits = Object.values(docs.all).filter((d) => words.some((w) => w.length > 3 && (d.summary.toLowerCase().includes(w) || d.description.toLowerCase().includes(w)))).slice(0, 6);
            if (hits.length) return 'These commands look relevant:<div class="chat-opts">' + hits.map((d) => '<div><code>' + esc(d.name) + '</code> ' + esc(d.summary) + '</div>').join('') + '</div><small>Ask me about any of them, or try ' + runBtn('apropos ' + words.find((w) => w.length > 3)) + '</small>';
            return 'I can explain any command (try "what does awk do?"), concepts like pipes, permissions, processes, networking, scripting, git or docker, and help with challenges.<div class="chat-examples">' + runBtn('help') + runBtn('tutorial') + '</div>';
        }

        // ---------------------------------------------------------- feedback
        toast(message, type) {
            const c = $('toast-container');
            const t = document.createElement('div');
            t.className = 'toast ' + (type || 'info');
            t.setAttribute('role', 'status');
            t.textContent = message;
            c.appendChild(t);
            setTimeout(() => { t.classList.add('leaving'); setTimeout(() => t.remove(), 300); }, 3500);
            while (c.children.length > 4) c.firstChild.remove();
        }
        sound(kind) {
            if (!this.state.settings.sound) return;
            try {
                const ctx = this.audio || (this.audio = new (window.AudioContext || window.webkitAudioContext)());
                const notes = kind === 'level' ? [523, 659, 784, 1047] : [660, 880];
                notes.forEach((f, i) => {
                    const o = ctx.createOscillator(), g = ctx.createGain();
                    o.frequency.value = f; o.type = 'sine';
                    g.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.09);
                    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.2);
                    o.connect(g); g.connect(ctx.destination);
                    o.start(ctx.currentTime + i * 0.09); o.stop(ctx.currentTime + i * 0.09 + 0.22);
                });
            } catch (e) { /* audio unavailable */ }
        }
        confetti() {
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            const host = document.createElement('div');
            host.className = 'confetti-host';
            for (let i = 0; i < 40; i++) {
                const p = document.createElement('i');
                p.style.left = Math.random() * 100 + '%';
                p.style.animationDelay = Math.random() * 0.4 + 's';
                p.style.background = ['#00ff41', '#00d4ff', '#8b5cf6', '#ffd700', '#ff5f56'][i % 5];
                host.appendChild(p);
            }
            document.body.appendChild(host);
            setTimeout(() => host.remove(), 2200);
        }
    }

    function fmtTime(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
    function timeAgo(t) {
        const s = Math.floor((Date.now() - t) / 1000);
        if (s < 60) return 'just now';
        if (s < 3600) return Math.floor(s / 60) + ' min ago';
        if (s < 86400) return Math.floor(s / 3600) + ' h ago';
        return Math.floor(s / 86400) + ' days ago';
    }

    // ================================================================ boot
    function setProgress(pct, text) {
        const f = $('loading-progress'); if (f) f.style.width = pct + '%';
        const s = $('loading-status'); if (s) s.textContent = text;
    }
    function showError(err) {
        console.error(err);
        const eb = $('error-boundary');
        if (!eb) return;
        $('error-message').textContent = 'Linux Arsenal failed to start: ' + (err && err.message ? err.message : String(err));
        eb.classList.remove('hidden');
        const ls = $('loading-screen'); if (ls) ls.classList.add('hidden');
    }
    function boot() {
        if (!LA || !LA.Shell || !LA.Terminal || !LA.challenges) { showError(new Error('required scripts did not load')); return; }
        setProgress(20, 'Booting kernel 6.8.0-45-generic...');
        setTimeout(() => {
            try {
                setProgress(55, 'Mounting virtual filesystem...');
                const app = new App();
                window.linuxArsenal = app;
                setProgress(85, 'Generating ' + app.challenges.length + ' challenges...');
                setTimeout(() => {
                    setProgress(100, 'Ready');
                    $('loading-screen').classList.add('hidden');
                    $('main-app').classList.remove('hidden');
                    const initial = (location.hash || '').replace('#', '');
                    app.switchSection(['dashboard', 'terminal', 'challenges', 'achievements', 'leaderboard', 'analytics'].includes(initial) ? initial : 'dashboard');
                    app.terminal.fit();
                }, 250);
            } catch (e) { showError(e); }
        }, 50);
    }
    window.addEventListener('error', (e) => { if (!window.linuxArsenal) showError(e.error || e.message); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
