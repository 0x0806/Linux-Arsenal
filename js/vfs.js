// Linux Arsenal - Virtual File System
// A self-contained in-memory POSIX-like filesystem (no access to the host OS).
(function () {
    'use strict';
    const LA = (globalThis.LA = globalThis.LA || {});

    class FsError extends Error {
        constructor(code, path) {
            const messages = {
                ENOENT: 'No such file or directory',
                EEXIST: 'File exists',
                ENOTDIR: 'Not a directory',
                EISDIR: 'Is a directory',
                ENOTEMPTY: 'Directory not empty',
                EACCES: 'Permission denied',
                EINVAL: 'Invalid argument',
                ELOOP: 'Too many levels of symbolic links',
                EPERM: 'Operation not permitted',
                EBUSY: 'Device or resource busy'
            };
            super(messages[code] || code);
            this.code = code;
            this.path = path;
        }
    }

    const S_IFMT = { file: '-', dir: 'd', link: 'l', dev: 'c' };
    let inodeCounter = 1000;

    function makeNode(type, extra) {
        const now = Date.now();
        const node = {
            type,
            mode: type === 'dir' ? 0o755 : type === 'link' ? 0o777 : 0o644,
            owner: 'root',
            group: 'root',
            mtime: now,
            ino: ++inodeCounter
        };
        if (type === 'dir') node.children = Object.create(null);
        if (type === 'file') node.content = '';
        if (type === 'link') node.target = '';
        return Object.assign(node, extra || {});
    }

    function splitPath(p) {
        return p.split('/').filter(Boolean);
    }

    function normalizePath(path, cwd, home) {
        if (path === undefined || path === null) path = '';
        path = String(path);
        if (path === '~' || path.startsWith('~/')) path = (home || '/') + path.slice(1);
        if (!path.startsWith('/')) path = (cwd || '/') + '/' + path;
        const out = [];
        for (const part of splitPath(path)) {
            if (part === '.') continue;
            if (part === '..') { out.pop(); continue; }
            out.push(part);
        }
        return '/' + out.join('/');
    }

    function dirname(p) {
        if (p === '/') return '/';
        const i = p.lastIndexOf('/');
        return i <= 0 ? '/' : p.slice(0, i);
    }

    function basename(p) {
        if (p === '/') return '/';
        return p.slice(p.lastIndexOf('/') + 1);
    }

    class VFS {
        constructor(root) {
            this.root = root || makeNode('dir', { mode: 0o755 });
            // user context used for permission checks; set by the shell
            this.user = { name: 'root', groups: ['root'] };
        }

        static get FsError() { return FsError; }
        static normalize(path, cwd, home) { return normalizePath(path, cwd, home); }
        static dirname(p) { return dirname(p); }
        static basename(p) { return basename(p); }
        static typeChar(node) { return S_IFMT[node.type] || '-'; }

        // ---------- permissions ----------
        can(node, perm) {
            const u = this.user;
            if (!u || u.name === 'root') {
                if (perm === 'x' && node.type === 'file') return (node.mode & 0o111) !== 0;
                return true;
            }
            const bits = { r: 4, w: 2, x: 1 }[perm];
            let shift;
            if (node.owner === u.name) shift = 6;
            else if ((u.groups || []).includes(node.group)) shift = 3;
            else shift = 0;
            return ((node.mode >> shift) & bits) !== 0;
        }

        // ---------- lookup ----------
        lookup(path, opts) {
            opts = opts || {};
            const follow = opts.follow !== false;
            let depth = 0;
            const walk = (abs, followLast) => {
                const parts = splitPath(abs);
                let node = this.root;
                let cur = '';
                for (let i = 0; i < parts.length; i++) {
                    if (node.type !== 'dir') throw new FsError('ENOTDIR', abs);
                    if (opts.checkPerms !== false && !this.can(node, 'x')) throw new FsError('EACCES', abs);
                    let child = node.children[parts[i]];
                    if (!child) return null;
                    const isLast = i === parts.length - 1;
                    if (child.type === 'link' && (!isLast || followLast)) {
                        if (++depth > 16) throw new FsError('ELOOP', abs);
                        const target = normalizePath(child.target, cur || '/');
                        const resolved = walk(target, true);
                        if (!resolved) return null;
                        child = resolved.node;
                        cur = resolved.path;
                    } else {
                        cur = cur + '/' + parts[i];
                    }
                    node = child;
                }
                return { node, path: cur || '/' };
            };
            return walk(path, follow);
        }

        get(path, opts) {
            const r = this.lookup(path, opts);
            return r ? r.node : null;
        }

        exists(path) {
            try { return !!this.get(path); } catch (e) { return false; }
        }

        isDir(path) {
            try { const n = this.get(path); return !!n && n.type === 'dir'; } catch (e) { return false; }
        }

        isFile(path) {
            try { const n = this.get(path); return !!n && n.type === 'file'; } catch (e) { return false; }
        }

        realpath(path) {
            const r = this.lookup(path);
            if (!r) throw new FsError('ENOENT', path);
            return r.path;
        }

        parent(path, opts) {
            const dir = dirname(path);
            const name = basename(path);
            const r = this.lookup(dir);
            if (!r) throw new FsError('ENOENT', path);
            if (r.node.type !== 'dir') throw new FsError('ENOTDIR', path);
            if (opts && opts.write && !this.can(r.node, 'w')) throw new FsError('EACCES', path);
            return { dir: r.node, name, dirPath: r.path };
        }

        // ---------- reading ----------
        readFile(path) {
            const node = this.get(path);
            if (!node) throw new FsError('ENOENT', path);
            if (node.type === 'dir') throw new FsError('EISDIR', path);
            if (!this.can(node, 'r')) throw new FsError('EACCES', path);
            if (node.type === 'dev') return this.readDevice(node);
            return node.content;
        }

        readDevice(node) {
            switch (node.device) {
                case 'zero': return '\0'.repeat(1024);
                case 'random':
                case 'urandom': {
                    let s = '';
                    for (let i = 0; i < 1024; i++) s += String.fromCharCode(Math.floor(Math.random() * 256));
                    return s;
                }
                default: return '';
            }
        }

        list(path) {
            const node = this.get(path);
            if (!node) throw new FsError('ENOENT', path);
            if (node.type !== 'dir') throw new FsError('ENOTDIR', path);
            if (!this.can(node, 'r')) throw new FsError('EACCES', path);
            return Object.keys(node.children).sort();
        }

        // ---------- writing ----------
        writeFile(path, content, opts) {
            opts = opts || {};
            let node = null;
            try { node = this.get(path); } catch (e) { if (e.code !== 'ENOENT') throw e; }
            if (node) {
                if (node.type === 'dir') throw new FsError('EISDIR', path);
                if (node.type === 'dev') return node;
                if (!this.can(node, 'w')) throw new FsError('EACCES', path);
                node.content = opts.append ? node.content + content : String(content);
                node.mtime = Date.now();
                return node;
            }
            const { dir, name } = this.parent(path, { write: true });
            const owner = (opts.owner) || this.user.name;
            node = makeNode('file', {
                content: String(content),
                mode: opts.mode !== undefined ? opts.mode : 0o644,
                owner,
                group: opts.group || this.primaryGroup(owner)
            });
            dir.children[name] = node;
            dir.mtime = Date.now();
            return node;
        }

        primaryGroup(owner) {
            return owner;
        }

        mkdir(path, opts) {
            opts = opts || {};
            if (opts.parents) {
                const parts = splitPath(path);
                let cur = '';
                for (const part of parts) {
                    cur += '/' + part;
                    const n = this.get(cur);
                    if (n) {
                        if (n.type !== 'dir') throw new FsError('ENOTDIR', cur);
                        continue;
                    }
                    this.mkdir(cur, Object.assign({}, opts, { parents: false }));
                }
                return this.get(path);
            }
            if (this.get(path, { follow: false })) throw new FsError('EEXIST', path);
            const { dir, name } = this.parent(path, { write: true });
            const owner = opts.owner || this.user.name;
            const node = makeNode('dir', {
                mode: opts.mode !== undefined ? opts.mode : 0o755,
                owner,
                group: opts.group || this.primaryGroup(owner)
            });
            dir.children[name] = node;
            dir.mtime = Date.now();
            return node;
        }

        symlink(target, path) {
            if (this.get(path, { follow: false })) throw new FsError('EEXIST', path);
            const { dir, name } = this.parent(path, { write: true });
            const node = makeNode('link', { target, owner: this.user.name, group: this.primaryGroup(this.user.name) });
            dir.children[name] = node;
            return node;
        }

        unlink(path) {
            const node = this.get(path, { follow: false });
            if (!node) throw new FsError('ENOENT', path);
            if (node.type === 'dir') throw new FsError('EISDIR', path);
            const { dir, name } = this.parent(path, { write: true });
            delete dir.children[name];
            dir.mtime = Date.now();
        }

        rmdir(path) {
            const node = this.get(path, { follow: false });
            if (!node) throw new FsError('ENOENT', path);
            if (node.type !== 'dir') throw new FsError('ENOTDIR', path);
            if (Object.keys(node.children).length) throw new FsError('ENOTEMPTY', path);
            if (path === '/') throw new FsError('EBUSY', path);
            const { dir, name } = this.parent(path, { write: true });
            delete dir.children[name];
        }

        rmrf(path) {
            const node = this.get(path, { follow: false });
            if (!node) throw new FsError('ENOENT', path);
            if (path === '/') throw new FsError('EPERM', path);
            const { dir, name } = this.parent(path, { write: true });
            if (node.type === 'dir' && this.user.name !== 'root') {
                // need write permission inside every directory being emptied
                const check = (n, p) => {
                    if (n.type !== 'dir') return;
                    if (Object.keys(n.children).length && !this.can(n, 'w')) throw new FsError('EACCES', p);
                    for (const k of Object.keys(n.children)) check(n.children[k], p + '/' + k);
                };
                check(node, path);
            }
            delete dir.children[name];
        }

        rename(src, dst) {
            const node = this.get(src, { follow: false });
            if (!node) throw new FsError('ENOENT', src);
            if (dst === src) return;
            if (node.type === 'dir' && (dst + '/').startsWith(src + '/')) throw new FsError('EINVAL', dst);
            const from = this.parent(src, { write: true });
            const to = this.parent(dst, { write: true });
            const existing = to.dir.children[to.name];
            if (existing && existing.type === 'dir' && node.type !== 'dir') throw new FsError('EISDIR', dst);
            if (existing && existing.type === 'dir' && Object.keys(existing.children).length) throw new FsError('ENOTEMPTY', dst);
            delete from.dir.children[from.name];
            to.dir.children[to.name] = node;
            node.mtime = node.mtime || Date.now();
        }

        cloneNode(node) {
            const copy = Object.assign({}, node, { ino: ++inodeCounter });
            if (node.type === 'dir') {
                copy.children = Object.create(null);
                for (const k of Object.keys(node.children)) copy.children[k] = this.cloneNode(node.children[k]);
            }
            return copy;
        }

        copy(src, dst, opts) {
            opts = opts || {};
            const node = this.get(src);
            if (!node) throw new FsError('ENOENT', src);
            if (!this.can(node, 'r')) throw new FsError('EACCES', src);
            const { dir, name } = this.parent(dst, { write: true });
            const copy = this.cloneNode(node);
            if (!opts.preserve) {
                const owner = this.user.name;
                const reown = (n) => {
                    n.owner = owner;
                    n.group = this.primaryGroup(owner);
                    n.mtime = Date.now();
                    if (n.type === 'dir') for (const k of Object.keys(n.children)) reown(n.children[k]);
                };
                reown(copy);
            }
            dir.children[name] = copy;
            return copy;
        }

        // ---------- metadata ----------
        size(node) {
            if (node.type === 'dir') return 4096;
            if (node.type === 'link') return node.target.length;
            if (node.type === 'dev') return 0;
            return utf8Length(node.content);
        }

        diskUsage(node) {
            if (node.type === 'dir') {
                let total = 4096;
                for (const k of Object.keys(node.children)) total += this.diskUsage(node.children[k]);
                return total;
            }
            const s = this.size(node);
            return s === 0 ? 0 : Math.ceil(s / 4096) * 4096;
        }

        walk(path, fn) {
            const start = this.get(path);
            if (!start) throw new FsError('ENOENT', path);
            const visit = (node, p, depth) => {
                fn(node, p, depth);
                if (node.type === 'dir') {
                    for (const k of Object.keys(node.children).sort()) {
                        visit(node.children[k], (p === '/' ? '' : p) + '/' + k, depth + 1);
                    }
                }
            };
            visit(start, path, 0);
        }

        // ---------- serialization ----------
        serialize() {
            const enc = (n) => {
                const o = { t: n.type, m: n.mode, o: n.owner, g: n.group, d: n.mtime };
                if (n.type === 'file') o.c = n.content;
                if (n.type === 'link') o.l = n.target;
                if (n.type === 'dev') o.v = n.device;
                if (n.type === 'dir') {
                    o.k = {};
                    for (const k of Object.keys(n.children)) o.k[k] = enc(n.children[k]);
                }
                return o;
            };
            return enc(this.root);
        }

        static deserialize(data) {
            const dec = (o) => {
                const n = makeNode(o.t, { mode: o.m, owner: o.o, group: o.g, mtime: o.d });
                if (o.t === 'file') n.content = o.c || '';
                if (o.t === 'link') n.target = o.l;
                if (o.t === 'dev') n.device = o.v;
                if (o.t === 'dir') {
                    for (const k of Object.keys(o.k || {})) n.children[k] = dec(o.k[k]);
                }
                return n;
            };
            return new VFS(dec(data));
        }

        clone() {
            const v = new VFS(this.cloneNode(this.root));
            v.user = Object.assign({}, this.user);
            return v;
        }
    }

    function utf8Length(str) {
        let len = 0;
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            if (c < 0x80) len += 1;
            else if (c < 0x800) len += 2;
            else if (c >= 0xd800 && c <= 0xdbff) { len += 4; i++; }
            else len += 3;
        }
        return len;
    }

    function modeString(node) {
        const m = node.mode;
        const t = S_IFMT[node.type] || '-';
        const r = (b, ch) => (m & b ? ch : '-');
        let s = t +
            r(0o400, 'r') + r(0o200, 'w') + (m & 0o4000 ? (m & 0o100 ? 's' : 'S') : r(0o100, 'x')) +
            r(0o040, 'r') + r(0o020, 'w') + (m & 0o2000 ? (m & 0o010 ? 's' : 'S') : r(0o010, 'x')) +
            r(0o004, 'r') + r(0o002, 'w') + (m & 0o1000 ? (m & 0o001 ? 't' : 'T') : r(0o001, 'x'));
        return s;
    }

    VFS.makeNode = makeNode;
    VFS.modeString = modeString;
    VFS.utf8Length = utf8Length;
    LA.VFS = VFS;
    LA.FsError = FsError;
    if (typeof module !== 'undefined' && module.exports) module.exports = VFS;
})();
