// Linux Arsenal - system administration commands (users, processes, services, packages, info, editors, fun)
(function () {
    'use strict';
    const LA = (globalThis.LA = globalThis.LA || {});
    const U = LA.util;
    const { getopt, usageError, readInputs, splitLines, humanSize, register } = U;
    const VFS = LA.VFS;
    const R = (name, fn, meta) => register(name, fn, meta);
    const KERNEL = '6.8.0-45-generic';
    const KVER = '#45-Ubuntu SMP PREEMPT_DYNAMIC Fri Aug 30 12:02:04 UTC 2024';

    // ---------------------------------------------------------------- user sessions (su / sudo -i)
    LA.Shell.prototype.switchUser = function (name, login) {
        this.userStack.push({ user: this.user, cwd: this.cwd, vars: new Map(Array.from(this.vars, ([k, v]) => [k, Object.assign({}, v)])), aliases: Object.assign(Object.create(null), this.aliases) });
        this.user = name;
        const home = this.system.homeOf(name) || '/';
        this.setVar('USER', name); this.setVar('LOGNAME', name); this.setVar('HOME', home);
        this.applyUser();
        if (login) {
            this.cwd = this.fs.isDir(home) ? home : '/';
            this.setVar('PWD', this.cwd);
            const shlvl = parseInt(this.getVar('SHLVL') || '1', 10);
            this.setVar('SHLVL', String(shlvl + 1));
        }
    };
    LA.Shell.prototype.restoreUserSession = function (prev) {
        this.user = prev.user;
        this.cwd = prev.cwd;
        this.vars = prev.vars;
        this.aliases = prev.aliases;
        this.applyUser();
    };
    function asRoot(sh, fn) {
        const saved = sh.fs.user;
        sh.fs.user = { name: 'root', groups: ['root'] };
        try { return fn(); } finally { sh.fs.user = saved; }
    }
    LA.asRoot = asRoot;
    const isRoot = (ctx) => ctx.sh.user === 'root';

    // ---------------------------------------------------------------- identity
    R('whoami', (ctx) => { ctx.outln(ctx.sh.user); return 0; });
    R('logname', (ctx) => { ctx.outln(ctx.sh.userStack.length ? ctx.sh.userStack[0].user : ctx.sh.user); return 0; });
    R('id', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: 'ugGnr' });
        const sys = ctx.sh.system;
        const name = operands[0] || ctx.sh.user;
        const u = sys.getUser(name);
        if (!u) return ctx.fail("'" + name + "': no such user");
        const groups = sys.groupsOf(name);
        const pg = sys.primaryGroupOf(name);
        if (opts.u) { ctx.outln(opts.n ? u.name : String(u.uid)); return 0; }
        if (opts.g) { ctx.outln(opts.n ? pg : String(u.gid)); return 0; }
        if (opts.G) { ctx.outln(groups.map((g) => (opts.n ? g : String(sys.gidOf(g)))).join(' ')); return 0; }
        ctx.outln('uid=' + u.uid + '(' + u.name + ') gid=' + u.gid + '(' + pg + ') groups=' + groups.map((g) => sys.gidOf(g) + '(' + g + ')').join(','));
        return 0;
    });
    R('groups', (ctx) => {
        const sys = ctx.sh.system;
        if (!ctx.args.length) { ctx.outln(sys.groupsOf(ctx.sh.user).join(' ')); return 0; }
        for (const n of ctx.args) {
            if (!sys.userExists(n)) { ctx.err("groups: '" + n + "': no such user\n"); continue; }
            ctx.outln(n + ' : ' + sys.groupsOf(n).join(' '));
        }
        return 0;
    });
    const loginTime = () => { const d = new Date(Date.now() - 34 * 60000); return d.getFullYear() + '-' + U.p2(d.getMonth() + 1) + '-' + U.p2(d.getDate()) + ' ' + U.p2(d.getHours()) + ':' + U.p2(d.getMinutes()); };
    R('who', (ctx) => {
        if (ctx.args.includes('-b')) { ctx.outln('         system boot  ' + U.isoDate(ctx.sh.system.bootTime).slice(0, 16)); return 0; }
        if (ctx.args.includes('-r')) { ctx.outln('         run-level 5  ' + U.isoDate(ctx.sh.system.bootTime).slice(0, 16)); return 0; }
        if (ctx.args.includes('-q')) { ctx.outln('user\n# users=1'); return 0; }
        if (ctx.args.includes('am') || ctx.args.includes('-m')) { ctx.outln('user     pts/0        ' + loginTime() + ' (192.168.1.15)'); return 0; }
        ctx.outln('user     pts/0        ' + loginTime() + ' (192.168.1.15)');
        return 0;
    });
    R('w', (ctx) => {
        const now = new Date();
        ctx.outln(' ' + U.strftime('%H:%M:%S', now) + ' up ' + uptimeText(ctx.sh.system) + ',  1 user,  load average: 0.42, 0.35, 0.28');
        ctx.outln('USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU  WHAT');
        ctx.outln('user     pts/0    192.168.1.15     ' + U.strftime('%H:%M', new Date(Date.now() - 34 * 60000)) + '    0.00s  0.12s  0.00s w');
        return 0;
    });
    R('users', (ctx) => { ctx.outln('user'); return 0; });
    R('last', (ctx) => {
        const rows = [
            ['user', 'pts/0', '192.168.1.15', 'still logged in'],
            ['alice', 'pts/1', '10.0.0.5', '- 11:42  (02:13)'],
            ['user', 'pts/0', '192.168.1.15', '- 18:01  (08:59)'],
            ['root', 'tty1', '', '- 09:12  (00:05)'],
            ['reboot', 'system boot', KERNEL, 'still running']
        ];
        const n = ctx.args.includes('-n') ? parseInt(ctx.args[ctx.args.indexOf('-n') + 1], 10) : rows.length;
        const filterUser = ctx.args.find((a) => !a.startsWith('-') && !/^\d+$/.test(a));
        for (const r of rows.filter((x) => !filterUser || x[0] === filterUser).slice(0, n)) ctx.outln(r[0].padEnd(9) + r[1].padEnd(13) + r[2].padEnd(17) + 'Wed Nov  4 09:16   ' + r[3]);
        ctx.outln('\nwtmp begins Sun Nov  1 08:00:01 2026');
        return 0;
    });
    R('lastlog', (ctx) => {
        ctx.outln('Username         Port     From             Latest');
        for (const u of ctx.sh.system.users) ctx.outln(u.name.padEnd(17) + (u.name === 'user' ? 'pts/0    192.168.1.15     Wed Nov  4 09:16:01 +0000 2026' : '                           **Never logged in**'));
        return 0;
    });

    R('hostname', (ctx) => {
        const sys = ctx.sh.system;
        const a = ctx.args;
        if (a.includes('-I') || a.includes('--all-ip-addresses')) { ctx.outln('192.168.1.100 172.17.0.1 '); return 0; }
        if (a.includes('-i')) { ctx.outln('127.0.1.1'); return 0; }
        if (a.includes('-f') || a.includes('--fqdn')) { ctx.outln(sys.hostname + '.internal'); return 0; }
        if (a.includes('-d')) { ctx.outln('internal'); return 0; }
        if (a.includes('-s')) { ctx.outln(sys.hostname.split('.')[0]); return 0; }
        const newName = a.find((x) => !x.startsWith('-'));
        if (newName) {
            if (!isRoot(ctx)) return ctx.fail('you must be root to change the host name');
            sys.hostname = newName; ctx.sh.hostname = newName;
            return 0;
        }
        ctx.outln(sys.hostname);
        return 0;
    });
    R('hostnamectl', (ctx) => {
        const sys = ctx.sh.system;
        if (ctx.args[0] === 'set-hostname') {
            if (!isRoot(ctx)) return ctx.fail('Could not set static hostname: Access denied');
            if (!ctx.args[1]) return ctx.fail('Missing argument');
            sys.hostname = ctx.args[1]; ctx.sh.hostname = ctx.args[1];
            asRoot(ctx.sh, () => ctx.fs.writeFile('/etc/hostname', ctx.args[1] + '\n'));
            return 0;
        }
        ctx.outln(' Static hostname: ' + sys.hostname + '\n       Icon name: computer-vm\n         Chassis: vm 🖴\n      Machine ID: 3f1c2a9e7b4d4c1e9f0a1d2e3c4b5a69\n         Boot ID: 7c1d0e8f2a3b4c5d6e7f8091a2b3c4d5\n  Virtualization: kvm\nOperating System: Ubuntu 24.04.1 LTS\n          Kernel: Linux ' + KERNEL + '\n    Architecture: x86-64\n Hardware Vendor: QEMU\n  Hardware Model: Standard PC _i440FX + PIIX, 1996_');
        return 0;
    });
    R('timedatectl', (ctx) => {
        const d = new Date();
        ctx.outln('               Local time: ' + U.strftime('%a %Y-%m-%d %H:%M:%S UTC', d) + '\n           Universal time: ' + U.strftime('%a %Y-%m-%d %H:%M:%S UTC', d) + '\n                 RTC time: ' + U.strftime('%a %Y-%m-%d %H:%M:%S', d) + '\n                Time zone: Etc/UTC (UTC, +0000)\nSystem clock synchronized: yes\n              NTP service: active\n          RTC in local TZ: no');
        return 0;
    });

    R('uname', (ctx) => {
        const { opts, error } = getopt(ctx.args, { flags: 'asnrvmpio', long: { all: 'a', 'kernel-name': 's', nodename: 'n', 'kernel-release': 'r', 'kernel-version': 'v', machine: 'm', processor: 'p', 'hardware-platform': 'i', 'operating-system': 'o' } });
        if (error) return usageError(ctx, error);
        const host = ctx.sh.system.hostname;
        const parts = [];
        const any = Object.keys(opts).length;
        if (opts.a) { ctx.outln('Linux ' + host + ' ' + KERNEL + ' ' + KVER + ' x86_64 x86_64 x86_64 GNU/Linux'); return 0; }
        if (!any || opts.s) parts.push('Linux');
        if (opts.n) parts.push(host);
        if (opts.r) parts.push(KERNEL);
        if (opts.v) parts.push(KVER);
        if (opts.m) parts.push('x86_64');
        if (opts.p) parts.push('x86_64');
        if (opts.i) parts.push('x86_64');
        if (opts.o) parts.push('GNU/Linux');
        ctx.outln(parts.join(' '));
        return 0;
    });
    R('arch', (ctx) => { ctx.outln('x86_64'); return 0; });
    R('nproc', (ctx) => { ctx.outln('4'); return 0; });

    function uptimeText(sys) {
        const s = sys.uptimeSeconds();
        const days = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
        return (days ? days + ' day' + (days > 1 ? 's' : '') + ', ' : '') + String(h).padStart(2) + ':' + U.p2(m);
    }
    R('uptime', (ctx) => {
        const sys = ctx.sh.system;
        const s = sys.uptimeSeconds();
        if (ctx.args.includes('-p') || ctx.args.includes('--pretty')) {
            const days = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
            const parts = [];
            if (days) parts.push(days + ' day' + (days > 1 ? 's' : ''));
            if (h) parts.push(h + ' hour' + (h > 1 ? 's' : ''));
            parts.push(m + ' minute' + (m !== 1 ? 's' : ''));
            ctx.outln('up ' + parts.join(', '));
            return 0;
        }
        if (ctx.args.includes('-s') || ctx.args.includes('--since')) { ctx.outln(U.isoDate(sys.bootTime)); return 0; }
        ctx.outln(' ' + U.strftime('%H:%M:%S', new Date()) + ' up ' + uptimeText(sys) + ',  1 user,  load average: 0.42, 0.35, 0.28');
        return 0;
    });

    R('free', (ctx) => {
        const { opts } = getopt(ctx.args, { flags: 'hbkmgtwl', long: { human: 'h', mega: 'mega', giga: 'giga', total: 't' } });
        const vals = { total: 8124168, used: 2248056, free: 3204112, shared: 18280, buff: 2671992, avail: 5876204, stotal: 2097148, sused: 0, sfree: 2097148 };
        const f = (kb) => {
            if (opts.h) {
                if (kb === 0) return '0B';
                const units = ['Ki', 'Mi', 'Gi', 'Ti'];
                let v = kb, i = 0;
                while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
                return (v < 10 ? v.toFixed(1) : String(Math.round(v))) + units[i];
            }
            if (opts.b) return String(kb * 1024);
            if (opts.m) return String(Math.floor(kb / 1024));
            if (opts.g) return String(Math.floor(kb / 1048576));
            return String(kb);
        };
        const w = 11;
        ctx.outln('               total        used        free      shared  buff/cache   available');
        ctx.outln('Mem:   ' + [vals.total, vals.used, vals.free, vals.shared, vals.buff, vals.avail].map((v) => f(v).padStart(w)).join(' ').replace(/^ /, ''));
        ctx.outln('Swap:  ' + [vals.stotal, vals.sused, vals.sfree].map((v) => f(v).padStart(w)).join(' ').replace(/^ /, ''));
        if (opts.t) ctx.outln('Total: ' + [vals.total + vals.stotal, vals.used, vals.free + vals.sfree].map((v) => f(v).padStart(w)).join(' ').replace(/^ /, ''));
        return 0;
    });

    // ---------------------------------------------------------------- processes
    function procList(sh) {
        const sys = sh.system;
        sys.reap();
        const list = sys.processes.slice();
        // the current interactive shell
        if (!list.some((p) => p.pid === 1002)) list.push({ pid: 1002, ppid: 1001, user: sh.user, cmd: '-bash', stat: 'Ss', cpu: 0, mem: 0, vsz: 10248, rss: 5280, tty: 'pts/0', start: sys.bootTime });
        return list.sort((a, b) => a.pid - b.pid);
    }
    function comm(cmd) {
        if (cmd.startsWith('[')) return cmd.replace(/^\[|\]$/g, '');
        const first = cmd.split(' ')[0].replace(/:$/, '');
        if (cmd.startsWith('-')) return first.slice(1);
        if (/^(python3|node|java|perl|ruby)$/.test(VFS.basename(first))) return VFS.basename(first);
        return VFS.basename(first);
    }
    LA.procComm = comm;
    function startStr(ms) {
        const d = new Date(ms);
        if (Date.now() - ms < 86400000) return U.p2(d.getHours()) + ':' + U.p2(d.getMinutes());
        return U.MONTHS[d.getMonth()] + U.p2(d.getDate());
    }
    function cpuTime(p) {
        const secs = Math.floor(((Date.now() - p.start) / 1000) * (p.cpu / 100));
        return U.p2(Math.floor(secs / 3600)) + ':' + U.p2(Math.floor(secs / 60) % 60) + ':' + U.p2(secs % 60);
    }
    function cpuTimeShort(p) {
        const secs = Math.floor(((Date.now() - p.start) / 1000) * (p.cpu / 100));
        return Math.floor(secs / 60) + ':' + U.p2(secs % 60);
    }
    R('ps', (ctx) => {
        const sh = ctx.sh;
        let args = ctx.args.slice();
        let bsd = false;
        if (args.length && /^[a-zA-Z]+$/.test(args[0]) && !args[0].startsWith('-')) { bsd = true; args[0] = '-' + args[0]; }
        const { opts, error } = getopt(args, { flags: 'aeAfFlxujwHr', args: 'opCUtg', long: { sort: 'sort=', forest: 'forest', 'no-headers': 'noh', pid: 'p=', user: 'U=', format: 'o=' } });
        if (error) return usageError(ctx, error);
        const me = { pid: (sh.system.nextPid || 2400) + 1, ppid: 1002, user: sh.user, cmd: 'ps ' + ctx.args.join(' '), stat: 'R+', cpu: 0, mem: 0, vsz: 11152, rss: 4224, tty: 'pts/0', start: Date.now() };
        let list = procList(sh).concat([me]);
        (sh.activePipeline || []).forEach((text, i) => {
            if (/^ps\b/.test(text)) return;
            list.push({ pid: me.pid + 1 + i, ppid: 1002, user: sh.user, cmd: text, stat: 'S+', cpu: 0, mem: 0, vsz: 9080, rss: 2304, tty: 'pts/0', start: Date.now() });
        });
        const all = opts.e || opts.A || (bsd && opts.a && opts.x) || (bsd && opts.x) || opts.a && !bsd && false;
        if (opts.p) { const pids = String(opts.p).split(',').map(Number); list = list.filter((p) => pids.includes(p.pid)); }
        else if (opts.C) { const names = String(opts.C).split(','); list = list.filter((p) => names.includes(comm(p.cmd))); }
        else if (opts.u && !bsd || opts.U) { const users = String(opts.U || opts.u).split(','); list = list.filter((p) => users.includes(p.user)); }
        else if (!all && !(bsd && opts.a) && !opts.u) list = list.filter((p) => p.tty === 'pts/0');
        else if (bsd && opts.a && !opts.x) list = list.filter((p) => p.tty !== '?');
        if (opts.sort) {
            for (const key of String(opts.sort).split(',').reverse()) {
                const desc = key.startsWith('-');
                const k = key.replace(/^[-+]/, '');
                const get = (p) => ({ pid: p.pid, ppid: p.ppid, '%cpu': p.cpu, pcpu: p.cpu, '%mem': p.mem, pmem: p.mem, rss: p.rss, vsz: p.vsz, user: p.user, comm: comm(p.cmd), cmd: p.cmd, start_time: p.start }[k]);
                list.sort((a, b) => { const x = get(a), y = get(b); const d = typeof x === 'number' ? x - y : String(x).localeCompare(String(y)); return desc ? -d : d; });
            }
        }
        const noHeader = opts.noh;
        if (opts.o) {
            const cols = String(opts.o).split(',').map((c) => c.split('=')[0]);
            const hdrs = { pid: 'PID', ppid: 'PPID', user: 'USER', comm: 'COMMAND', cmd: 'CMD', args: 'COMMAND', command: 'COMMAND', '%cpu': '%CPU', pcpu: '%CPU', '%mem': '%MEM', pmem: '%MEM', vsz: 'VSZ', rss: 'RSS', stat: 'STAT', tty: 'TT', etime: 'ELAPSED', time: 'TIME', uid: 'UID', ni: 'NI', start: 'STARTED' };
            const val = (p, c) => ({ pid: p.pid, ppid: p.ppid, user: p.user, comm: comm(p.cmd), cmd: p.cmd, args: p.cmd, command: p.cmd, '%cpu': p.cpu.toFixed(1), pcpu: p.cpu.toFixed(1), '%mem': p.mem.toFixed(1), pmem: p.mem.toFixed(1), vsz: p.vsz, rss: p.rss, stat: p.stat, tty: p.tty, etime: elapsed(p.start), time: cpuTime(p), uid: sh.system.uidOf(p.user), ni: 0, start: startStr(p.start) }[c]);
            const rows = list.map((p) => cols.map((c) => String(val(p, c) === undefined ? '-' : val(p, c))));
            const widths = cols.map((c, i) => Math.max((hdrs[c] || c.toUpperCase()).length, ...rows.map((r) => r[i].length)));
            const numeric = (c) => ['pid', 'ppid', '%cpu', 'pcpu', '%mem', 'pmem', 'vsz', 'rss', 'uid', 'ni'].includes(c);
            const fmt = (cells) => cells.map((cell, i) => (i === cells.length - 1 ? cell : numeric(cols[i]) ? cell.padStart(widths[i]) : cell.padEnd(widths[i]))).join(' ');
            if (!noHeader) ctx.outln(fmt(cols.map((c) => hdrs[c] || c.toUpperCase())));
            for (const r of rows) ctx.outln(fmt(r));
            return 0;
        }
        if (bsd && opts.u) {
            const vszW = Math.max(6, ...list.map((p) => String(p.vsz).length));
            const rssW = Math.max(5, ...list.map((p) => String(p.rss).length));
            if (!noHeader) ctx.outln('USER         PID %CPU %MEM ' + 'VSZ'.padStart(vszW) + ' ' + 'RSS'.padStart(rssW) + ' TTY      STAT START   TIME COMMAND');
            for (const p of list) {
                const line = p.user.slice(0, 8).padEnd(8) + String(p.pid).padStart(8) + p.cpu.toFixed(1).padStart(5) + p.mem.toFixed(1).padStart(5) + ' ' + String(p.vsz).padStart(vszW) + ' ' + String(p.rss).padStart(rssW) + ' ' + p.tty.padEnd(8) + ' ' + p.stat.padEnd(4) + ' ' + startStr(p.start).padStart(5) + cpuTimeShort(p).padStart(7) + ' ' + p.cmd;
                ctx.outln(ctx.tty ? line.slice(0, Math.max(ctx.sh.columns, 80)) : line);
            }
            return 0;
        }
        if (opts.f || opts.F) {
            if (!noHeader) ctx.outln('UID          PID    PPID  C STIME TTY          TIME CMD');
            for (const p of list) ctx.outln(p.user.slice(0, 8).padEnd(8) + String(p.pid).padStart(8) + String(p.ppid).padStart(8) + String(Math.round(p.cpu)).padStart(3) + ' ' + startStr(p.start).padEnd(5) + ' ' + p.tty.padEnd(8) + ' ' + cpuTime(p) + ' ' + p.cmd);
            return 0;
        }
        if (opts.l) {
            if (!noHeader) ctx.outln('F S   UID     PID    PPID  C PRI  NI ADDR SZ WCHAN  TTY          TIME CMD');
            for (const p of list) ctx.outln('4 ' + p.stat[0] + String(sh.system.uidOf(p.user)).padStart(6) + String(p.pid).padStart(8) + String(p.ppid).padStart(8) + '  0  80   0 -  ' + String(Math.floor(p.vsz / 4)).padStart(4) + ' -      ' + p.tty.padEnd(8) + ' ' + cpuTime(p) + ' ' + comm(p.cmd));
            return 0;
        }
        if (!noHeader) ctx.outln('    PID TTY          TIME CMD');
        for (const p of list) ctx.outln(String(p.pid).padStart(7) + ' ' + p.tty.padEnd(8) + ' ' + cpuTime(p) + ' ' + comm(p.cmd));
        return 0;
    });
    function elapsed(ms) {
        const s = Math.floor((Date.now() - ms) / 1000);
        const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        return (d ? d + '-' : '') + (d || h ? U.p2(h) + ':' : '') + U.p2(m) + ':' + U.p2(sec);
    }

    function topSnapshot(sh, opts) {
        opts = opts || {};
        const list = procList(sh);
        const now = new Date();
        const running = list.filter((p) => p.stat.startsWith('R')).length;
        const total = list.length;
        const jitter = opts.jitter ? (x) => Math.max(0, x + (Math.random() - 0.5) * x * 0.3) : (x) => x;
        const rows = list.map((p) => Object.assign({}, p, { cpu: jitter(p.cpu) })).sort((a, b) => (opts.sortMem ? b.mem - a.mem : b.cpu - a.cpu || a.pid - b.pid));
        const usCpu = Math.min(99, rows.reduce((a, p) => a + p.cpu, 0) / 4);
        const lines = [
            'top - ' + U.strftime('%H:%M:%S', now) + ' up ' + uptimeText(sh.system) + ',  1 user,  load average: 0.42, 0.35, 0.28',
            'Tasks: ' + String(total).padStart(3) + ' total,   ' + running + ' running, ' + (total - running) + ' sleeping,   0 stopped,   0 zombie',
            '%Cpu(s): ' + usCpu.toFixed(1).padStart(4) + ' us,  1.2 sy,  0.0 ni, ' + (100 - usCpu - 1.3).toFixed(1).padStart(4) + ' id,  0.1 wa,  0.0 hi,  0.0 si,  0.0 st',
            'MiB Mem :   7933.8 total,   3129.0 free,   2195.4 used,   2609.4 buff/cache',
            'MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   5738.5 avail Mem',
            '',
            '    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND'
        ];
        for (const p of rows.slice(0, opts.limit || rows.length)) {
            lines.push(String(p.pid).padStart(7) + ' ' + p.user.slice(0, 8).padEnd(8) + '  20   0 ' + String(p.vsz).padStart(7) + ' ' + String(p.rss).padStart(6) + ' ' + String(Math.floor(p.rss * 0.6)).padStart(6) + ' ' + p.stat[0] + ' ' + p.cpu.toFixed(1).padStart(5) + ' ' + p.mem.toFixed(1).padStart(5) + ' ' + (cpuTimeShort(p) + '.' + U.p2(p.pid % 100)).padStart(9) + ' ' + comm(p.cmd));
        }
        return lines;
    }
    LA.topSnapshot = topSnapshot;
    R('top', (ctx) => {
        const { opts } = getopt(ctx.args, { flags: 'bcHiSs', args: 'npduo' });
        if (!opts.b && ctx.tty && ctx.sh.ui && ctx.sh.ui.openTop) { ctx.sh.ui.openTop({ shell: ctx.sh, htop: false }); return 0; }
        let lines = topSnapshot(ctx.sh, { sortMem: opts.o === '%MEM' || opts.o === '-%MEM' });
        if (opts.u) lines = lines.slice(0, 7).concat(lines.slice(7).filter((l) => l.split(/\s+/)[2] === opts.u));
        if (opts.p) lines = lines.slice(0, 7).concat(lines.slice(7).filter((l) => String(opts.p).split(',').includes(l.trim().split(/\s+/)[0])));
        ctx.out(lines.join('\n') + '\n');
        return 0;
    });
    R('htop', (ctx) => {
        if (ctx.tty && ctx.sh.ui && ctx.sh.ui.openTop) { ctx.sh.ui.openTop({ shell: ctx.sh, htop: true }); return 0; }
        ctx.out(topSnapshot(ctx.sh).join('\n') + '\n');
        return 0;
    }, { pkg: 'htop' });

    function matchProcs(ctx, pattern, full, exact, user) {
        let re;
        try { re = exact ? new RegExp('^' + pattern + '$') : new RegExp(pattern); } catch (e) { return null; }
        return procList(ctx.sh).filter((p) => (full ? re.test(p.cmd) : re.test(comm(p.cmd).slice(0, 15))) && (!user || p.user === user) && p.pid !== 1002);
    }
    R('pgrep', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'flaxcn', args: 'u', long: { full: 'f', 'list-name': 'l', 'list-full': 'a', exact: 'x', count: 'c' } });
        if (error) return usageError(ctx, error);
        if (!operands.length && !opts.u) return ctx.fail('no matching criteria specified\nTry `pgrep --help\' for more information.', 2);
        const list = matchProcs(ctx, operands[0] || '.', opts.f, opts.x, opts.u);
        if (!list) return ctx.fail('invalid regex', 2);
        if (opts.c) { ctx.outln(String(list.length)); return list.length ? 0 : 1; }
        for (const p of opts.n ? list.slice(-1) : list) ctx.outln(p.pid + (opts.l ? ' ' + comm(p.cmd) : opts.a ? ' ' + p.cmd : ''));
        return list.length ? 0 : 1;
    });
    R('pkill', (ctx) => {
        let args = ctx.args.slice();
        let sig = 'TERM';
        if (args[0] && /^-[A-Z0-9]+$/.test(args[0]) && args[0] !== '-f') { sig = args[0].slice(1); args = args.slice(1); }
        const { opts, operands, error } = getopt(args, { flags: 'fxe', args: 'u', long: { full: 'f', exact: 'x', signal: 'signal=' } });
        if (error) return usageError(ctx, error);
        if (opts.signal) sig = opts.signal;
        if (!operands.length && !opts.u) return ctx.fail('no matching criteria specified', 2);
        const list = matchProcs(ctx, operands[0] || '.', opts.f, opts.x, opts.u);
        if (!list || !list.length) return 1;
        let status = 0;
        for (const p of list) {
            const r = ctx.sh.system.signalProcess(p.pid, sig, ctx.sh.user);
            if (r === 'EPERM') { ctx.err('pkill: killing pid ' + p.pid + ' failed: Operation not permitted\n'); status = 1; }
            else if (opts.e) ctx.outln(comm(p.cmd) + ' killed (pid ' + p.pid + ')');
        }
        return status;
    });
    R('killall', (ctx) => {
        let args = ctx.args.slice();
        let sig = 'TERM';
        if (args[0] === '-s') { sig = args[1]; args = args.slice(2); }
        else if (args[0] && /^-[A-Z0-9]+$/.test(args[0]) && !['-v', '-i', '-q'].includes(args[0])) { sig = args[0].slice(1); args = args.slice(1); }
        const verbose = args.includes('-v');
        const names = args.filter((a) => !a.startsWith('-'));
        if (!names.length) return usageError(ctx, 'Usage: killall [OPTION]... [--] NAME...');
        let status = 0;
        for (const nm of names) {
            const list = procList(ctx.sh).filter((p) => comm(p.cmd) === nm);
            if (!list.length) { ctx.err(nm + ': no process found\n'); status = 1; continue; }
            for (const p of list) {
                const r = ctx.sh.system.signalProcess(p.pid, sig, ctx.sh.user);
                if (r === 'EPERM') { ctx.err(nm + '(' + p.pid + '): Operation not permitted\n'); status = 1; }
                else if (verbose) ctx.outln('Killed ' + nm + '(' + p.pid + ') with signal ' + (/^\d+$/.test(sig) ? sig : 15));
            }
        }
        return status;
    });
    R('pidof', (ctx) => {
        const pids = procList(ctx.sh).filter((p) => ctx.args.includes(comm(p.cmd))).map((p) => p.pid).sort((a, b) => b - a);
        if (!pids.length) return 1;
        ctx.outln(pids.join(' '));
        return 0;
    });
    R('pstree', (ctx) => {
        const list = procList(ctx.sh);
        const showPid = ctx.args.includes('-p');
        const children = (pid) => list.filter((p) => p.ppid === pid && p.pid !== pid);
        const label = (p) => comm(p.cmd) + (showPid ? '(' + p.pid + ')' : '');
        const lines = [];
        const walk = (p, prefix, isLast, isRoot) => {
            lines.push((isRoot ? '' : prefix + (isLast ? '└─' : '├─')) + label(p));
            const kids = children(p.pid).filter((k) => !k.cmd.startsWith('['));
            kids.forEach((k, i) => walk(k, isRoot ? '' : prefix + (isLast ? '  ' : '│ '), i === kids.length - 1, false));
        };
        const root = list.find((p) => p.pid === 1);
        if (root) walk(root, '', true, true);
        ctx.out(lines.join('\n') + '\n');
        return 0;
    });
    R('nice', (ctx) => {
        let args = ctx.args.slice();
        if (args[0] === '-n') args = args.slice(2);
        else if (args[0] && /^-\d+$/.test(args[0])) args = args.slice(1);
        if (!args.length) { ctx.outln('0'); return 0; }
        return ctx.exec(args);
    });
    R('renice', (ctx) => {
        const pid = ctx.args[ctx.args.length - 1];
        const pr = ctx.args.find((a) => /^-?\d+$/.test(a) && a !== pid) || '0';
        if (!procList(ctx.sh).some((p) => String(p.pid) === pid)) return ctx.fail('failed to get priority for ' + pid + ' (process ID): No such process');
        ctx.outln(pid + ' (process ID) old priority 0, new priority ' + pr.replace(/^-n/, ''));
        return 0;
    });
    R('nohup', (ctx) => {
        if (!ctx.args.length) return usageError(ctx, 'missing operand');
        if (ctx.tty) ctx.err("nohup: ignoring input and appending output to 'nohup.out'\n");
        const buf = new LA.CollectWriter();
        const code = ctx.exec(ctx.args, Object.assign({}, ctx.io, { stdout: buf, tty: false }));
        if (ctx.tty) { try { ctx.fs.writeFile(ctx.resolve('nohup.out'), buf.toString(), { append: true }); } catch (e) { /* ignore */ } }
        else ctx.out(buf.toString());
        return code;
    });
    R('timeout', (ctx) => {
        const args = ctx.args.filter((a, i) => !(a.startsWith('-') && i === 0));
        if (args.length < 2) return usageError(ctx, 'missing operand');
        return ctx.exec(args.slice(1));
    });
    R('watch', (ctx) => {
        const { opts, operands } = getopt(ctx.args, { flags: 'tdgecx', args: 'n', stopAtFirst: true });
        if (!operands.length) return usageError(ctx, 'Usage:\n watch [options] command');
        const cmd = operands.join(' ');
        if (!opts.t) ctx.outln('Every ' + parseFloat(opts.n || '2').toFixed(1) + 's: ' + cmd + ' '.repeat(Math.max(1, 40 - cmd.length)) + ctx.sh.system.hostname + ': ' + U.defaultDate(new Date()) + '\n');
        ctx.run(cmd);
        if (ctx.tty) ctx.err('\n(watch ran once: live refresh is not available in the sandbox)\n');
        return 0;
    });

    R('env', (ctx) => {
        let args = ctx.args.slice();
        const sh = ctx.sh;
        let clear = false;
        const unset = [];
        while (args.length) {
            if (args[0] === '-i' || args[0] === '-' || args[0] === '--ignore-environment') { clear = true; args.shift(); continue; }
            if (args[0] === '-u') { unset.push(args[1]); args = args.slice(2); continue; }
            break;
        }
        const assigns = [];
        while (args.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(args[0])) assigns.push(args.shift());
        if (!args.length) {
            const env = clear ? {} : sh.envObject();
            for (const u of unset) delete env[u];
            for (const a of assigns) { const eq = a.indexOf('='); env[a.slice(0, eq)] = a.slice(eq + 1); }
            for (const k of Object.keys(env)) ctx.outln(k + '=' + env[k]);
            return 0;
        }
        const saved = new Map(sh.vars);
        try {
            if (clear) for (const [k, v] of sh.vars) if (v.exported) sh.vars.delete(k);
            for (const u of unset) sh.vars.delete(u);
            for (const a of assigns) { const eq = a.indexOf('='); sh.vars.set(a.slice(0, eq), { value: a.slice(eq + 1), exported: true }); }
            return ctx.exec(args);
        } finally { sh.vars = saved; }
    });
    R('printenv', (ctx) => {
        const env = ctx.sh.envObject();
        if (!ctx.args.length) { for (const k of Object.keys(env)) ctx.outln(k + '=' + env[k]); return 0; }
        let status = 0;
        for (const k of ctx.args) { if (env[k] === undefined) status = 1; else ctx.outln(env[k]); }
        return status;
    });

    // ---------------------------------------------------------------- hardware / kernel info
    R('lscpu', (ctx) => {
        ctx.outln('Architecture:             x86_64\n  CPU op-mode(s):         32-bit, 64-bit\n  Address sizes:          46 bits physical, 48 bits virtual\n  Byte Order:             Little Endian\nCPU(s):                   4\n  On-line CPU(s) list:    0-3\nVendor ID:                GenuineIntel\n  Model name:             Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz\n    CPU family:           6\n    Model:                79\n    Thread(s) per core:   1\n    Core(s) per socket:   4\n    Socket(s):            1\n    BogoMIPS:             4799.99\nVirtualization features:\n  Hypervisor vendor:      KVM\n  Virtualization type:    full\nCaches (sum of all):\n  L1d:                    128 KiB (4 instances)\n  L1i:                    128 KiB (4 instances)\n  L2:                     16 MiB (4 instances)\n  L3:                     35 MiB (1 instance)');
        return 0;
    });
    R('lsblk', (ctx) => {
        if (ctx.args.includes('-f')) {
            ctx.outln('NAME    FSTYPE FSVER LABEL UUID                                 FSAVAIL FSUSE% MOUNTPOINTS\nsda\n├─sda1  ext4   1.0         3f1c2a9e-7b4d-4c1e-9f0a-1d2e3c4b5a69   51.4G    11% /\n├─sda14\n└─sda15 vfat   FAT32       AB12-CD34                              98.3M     6% /boot/efi\nsr0');
            return 0;
        }
        ctx.outln('NAME    MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS\nsda       8:0    0   60G  0 disk \n├─sda1    8:1    0 59.9G  0 part /\n├─sda14   8:14   0    4M  0 part \n└─sda15   8:15   0  106M  0 part /boot/efi\nsr0      11:0    1 1024M  0 rom  ');
        return 0;
    });
    R('lsusb', (ctx) => { ctx.outln('Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub\nBus 001 Device 002: ID 0627:0001 Adomax Technology Co., Ltd QEMU USB Tablet\nBus 002 Device 001: ID 1d6b:0003 Linux Foundation 3.0 root hub'); return 0; });
    R('lspci', (ctx) => { ctx.outln('00:00.0 Host bridge: Intel Corporation 440FX - 82441FX PMC [Natoma] (rev 02)\n00:01.0 ISA bridge: Intel Corporation 82371SB PIIX3 ISA [Natoma/Triton II]\n00:02.0 VGA compatible controller: Device 1234:1111 (rev 02)\n00:03.0 Ethernet controller: Intel Corporation 82540EM Gigabit Ethernet Controller (rev 03)\n00:04.0 SCSI storage controller: Red Hat, Inc. Virtio SCSI'); return 0; });
    R('lsmod', (ctx) => { ctx.outln('Module                  Size  Used by\nip_tables              32768  0\nx_tables               65536  1 ip_tables\nbridge                421888  0\nstp                    12288  1 bridge\noverlay               212992  0\ne1000                 180224  0\nvirtio_scsi            28672  2\next4                 1101824  1\nmbcache                16384  1 ext4'); return 0; });
    R('modprobe', (ctx) => (isRoot(ctx) ? 0 : ctx.fail('ERROR: could not insert \'' + (ctx.args[0] || '') + "': Operation not permitted")));
    R('mount', (ctx) => {
        if (ctx.args.length && !ctx.args.every((a) => a.startsWith('-'))) {
            if (!isRoot(ctx)) return ctx.fail('only root can do that.', 1);
            const ops = ctx.args.filter((a) => !a.startsWith('-'));
            if (ops.length === 2) { ctx.sh.system.mounts.push({ dev: ops[0], on: ctx.resolve(ops[1]) }); return 0; }
            return 0;
        }
        const extra = ctx.sh.system.mounts.map((m) => m.dev + ' on ' + m.on + ' type ext4 (rw,relatime)').join('\n');
        ctx.outln('sysfs on /sys type sysfs (rw,nosuid,nodev,noexec,relatime)\nproc on /proc type proc (rw,nosuid,nodev,noexec,relatime)\nudev on /dev type devtmpfs (rw,nosuid,relatime,size=4002536k,nr_inodes=1000634,mode=755)\ntmpfs on /run type tmpfs (rw,nosuid,nodev,noexec,relatime,size=812420k,mode=755)\n/dev/sda1 on / type ext4 (rw,relatime,discard,errors=remount-ro)\ntmpfs on /dev/shm type tmpfs (rw,nosuid,nodev)\n/dev/sda15 on /boot/efi type vfat (rw,relatime,fmask=0077,dmask=0077)' + (extra ? '\n' + extra : ''));
        return 0;
    });
    R('umount', (ctx) => {
        if (!isRoot(ctx)) return ctx.fail(ctx.args[0] + ': must be superuser to unmount.', 32);
        const p = ctx.resolve(ctx.args[0] || '');
        const sys = ctx.sh.system;
        const before = sys.mounts.length;
        sys.mounts = sys.mounts.filter((m) => m.on !== p && m.dev !== ctx.args[0]);
        return before === sys.mounts.length ? ctx.fail(ctx.args[0] + ': not mounted.', 32) : 0;
    });
    R('dmesg', (ctx) => {
        let text = ctx.fs.readFile('/var/log/dmesg');
        if (ctx.args.includes('-T')) text = text.replace(/^\[\s*[\d.]+\]/gm, '[' + U.defaultDate(new Date(ctx.sh.system.bootTime)) + ']');
        ctx.out(text);
        return 0;
    });
    R('sysctl', (ctx) => {
        const vals = { 'kernel.hostname': ctx.sh.system.hostname, 'kernel.ostype': 'Linux', 'kernel.osrelease': KERNEL, 'net.ipv4.ip_forward': '0', 'vm.swappiness': '60', 'fs.file-max': '9223372036854775807', 'kernel.pid_max': '4194304', 'net.core.somaxconn': '4096' };
        if (ctx.args.includes('-a')) { for (const k of Object.keys(vals).sort()) ctx.outln(k + ' = ' + vals[k]); return 0; }
        for (const a of ctx.args.filter((x) => !x.startsWith('-'))) {
            if (a.includes('=')) { if (!isRoot(ctx)) return ctx.fail('permission denied on key "' + a.split('=')[0] + '"', 255); ctx.outln(a.replace('=', ' = ')); continue; }
            if (vals[a] === undefined) { ctx.err('sysctl: cannot stat /proc/sys/' + a.replace(/\./g, '/') + ': No such file or directory\n'); continue; }
            ctx.outln(ctx.args.includes('-n') ? vals[a] : a + ' = ' + vals[a]);
        }
        return 0;
    });
    R('vmstat', (ctx) => { ctx.outln('procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----\n r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st\n 2  0      0 3204112 212344 2459648    0    0     5    12  110  210 22  1 77  0  0'); return 0; });
    R('iostat', (ctx) => { ctx.outln('Linux ' + KERNEL + ' (' + ctx.sh.system.hostname + ') \t' + U.strftime('%m/%d/%Y', new Date()) + ' \t_x86_64_\t(4 CPU)\n\navg-cpu:  %user   %nice %system %iowait  %steal   %idle\n          21.90    0.00    1.20    0.10    0.00   76.80\n\nDevice             tps    kB_read/s    kB_wrtn/s    kB_dscd/s    kB_read    kB_wrtn    kB_dscd\nsda               3.42        20.11        48.60         0.00    5498612   13289044          0'); return 0; });
    R('lsof', (ctx) => {
        const net = ctx.args.includes('-i');
        if (net) {
            ctx.outln('COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME');
            ctx.outln('node     2190 user   21u  IPv6  31337      0t0  TCP *:3000 (LISTEN)');
            if (isRoot(ctx)) ctx.outln('sshd      512 root    3u  IPv4  21212      0t0  TCP *:ssh (LISTEN)\nnginx     640 root    6u  IPv4  22014      0t0  TCP *:http (LISTEN)');
            return 0;
        }
        ctx.outln('COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF    NODE NAME\nbash     1002 user  cwd    DIR    8,1     4096  131074 ' + ctx.sh.cwd + '\nbash     1002 user  rtd    DIR    8,1     4096       2 /\nbash     1002 user  txt    REG    8,1  1446024 1048601 /usr/bin/bash\nbash     1002 user    0u   CHR  136,0      0t0       3 /dev/pts/0');
        return 0;
    });

    function powerCmd(ctx) {
        if (!isRoot(ctx)) { ctx.err('Call to ' + (ctx.name === 'shutdown' ? 'PowerOff' : ctx.name.charAt(0).toUpperCase() + ctx.name.slice(1)) + ' failed: Access denied\n'); return 1; }
        ctx.outln('Broadcast message from root@' + ctx.sh.system.hostname + ' on pts/0 (' + U.defaultDate(new Date()) + '):\n\nThe system will ' + (ctx.name === 'reboot' ? 'reboot' : 'power off') + ' now!\n\n(Linux Arsenal is a sandbox: the machine keeps running so you can keep learning.)');
        return 0;
    }
    R('shutdown', powerCmd); R('reboot', powerCmd); R('poweroff', powerCmd); R('halt', powerCmd);

    // ---------------------------------------------------------------- privilege
    R('sudo', (ctx) => {
        const sh = ctx.sh;
        const sys = sh.system;
        let args = ctx.args.slice();
        let targetUser = 'root';
        let login = false, shellMode = false, list = false;
        while (args.length && args[0].startsWith('-')) {
            const a = args.shift();
            if (a === '-u') targetUser = args.shift();
            else if (a === '-i') login = true;
            else if (a === '-s') shellMode = true;
            else if (a === '-l') list = true;
            else if (a === '-k' || a === '-K') return 0;
            else if (a === '-v') return 0;
            else if (a === '--') break;
            else if (a === '-E' || a === '-H' || a === '-n' || a === '-S') continue;
            else return usageError(ctx, 'invalid option -- \'' + a.slice(1) + "'");
        }
        if (sh.user !== 'root' && !sys.groupsOf(sh.user).includes('sudo')) {
            ctx.err(sh.user + ' is not in the sudoers file.  This incident will be reported.\n');
            return 1;
        }
        if (list) {
            ctx.outln('Matching Defaults entries for ' + sh.user + ' on ' + sys.hostname + ':\n    env_reset, mail_badpass, secure_path=/usr/local/sbin\\:/usr/local/bin\\:/usr/sbin\\:/usr/bin\\:/sbin\\:/bin\n\nUser ' + sh.user + ' may run the following commands on ' + sys.hostname + ':\n    (ALL : ALL) ALL');
            return 0;
        }
        if (!sys.userExists(targetUser)) return ctx.fail('unknown user ' + targetUser);
        if (login || shellMode || (!args.length)) {
            if (!args.length && !login && !shellMode) { ctx.err('usage: sudo -h | -K | -k | -V\nusage: sudo -v [-ABkNnS] [-g group] [-h host] [-p prompt] [-u user]\nusage: sudo -l [-ABkNnS] [-g group] [-h host] [-p prompt] [-U user] [-u user] [command [arg ...]]\nusage: sudo [-ABbEHkNnPS] [-r role] [-t type] [-C num] [-D directory] [-g group] [-h host] [-p prompt] [-R directory] [-T timeout] [-u user] [VAR=value] [-i | -s] [command [arg ...]]\n'); return 1; }
            if (!args.length) { sh.switchUser(targetUser, login); return 0; }
        }
        // sudo su / sudo su - / sudo bash -> interactive root
        if ((args[0] === 'su' && (args.length === 1 || args[1] === '-' || args[1] === '-l' || args[1] === 'root')) || ((args[0] === 'bash' || args[0] === 'sh') && args.length === 1)) {
            sh.switchUser('root', args[1] === '-' || args[1] === '-l');
            return 0;
        }
        const prev = { user: sh.user };
        sh.user = targetUser;
        sh.applyUser();
        const savedVars = { USER: sh.getVar('USER'), HOME: sh.getVar('HOME'), LOGNAME: sh.getVar('LOGNAME') };
        sh.setVar('USER', targetUser); sh.setVar('LOGNAME', targetUser); sh.setVar('SUDO_USER', prev.user, { exported: true });
        try {
            return ctx.exec(args);
        } finally {
            sh.user = prev.user;
            sh.applyUser();
            for (const [k, v] of Object.entries(savedVars)) if (v !== undefined) sh.setVar(k, v);
            sh.unsetVar('SUDO_USER');
        }
    });
    R('su', (ctx) => {
        const sh = ctx.sh;
        let args = ctx.args.slice();
        let login = false, cmd = null;
        const rest = [];
        for (let i = 0; i < args.length; i++) {
            if (args[i] === '-' || args[i] === '-l' || args[i] === '--login') login = true;
            else if (args[i] === '-c') cmd = args[++i];
            else rest.push(args[i]);
        }
        const target = rest[0] || 'root';
        if (!sh.system.userExists(target)) return ctx.fail('user ' + target + ' does not exist or the user entry does not contain all the required fields');
        const u = sh.system.getUser(target);
        if (u.shell.includes('nologin') || u.shell === '/bin/false') { if (ctx.tty) ctx.outln('This account is currently not available.'); return 1; }
        if (sh.user !== 'root' && ctx.tty) ctx.err('Password: \n');
        if (cmd) {
            const prevUser = sh.user;
            sh.user = target; sh.applyUser();
            try { return ctx.run(cmd); } finally { sh.user = prevUser; sh.applyUser(); }
        }
        sh.switchUser(target, login);
        return 0;
    });
    R('passwd', (ctx) => {
        const sh = ctx.sh;
        const args = ctx.args.filter((a) => !a.startsWith('-'));
        const target = args[0] || sh.user;
        if (target !== sh.user && sh.user !== 'root') return ctx.fail('You may not view or modify password information for ' + target + '.');
        if (!sh.system.userExists(target)) return ctx.fail("user '" + target + "' does not exist");
        if (ctx.args.includes('-S')) { ctx.outln(target + ' P 2024-03-15 0 99999 7 -1'); return 0; }
        if (ctx.args.includes('-l')) { if (sh.user !== 'root') return ctx.fail('Permission denied.'); sh.system.passwords[target] = null; ctx.outln('passwd: password changed.'); return 0; }
        if (ctx.tty) ctx.out((target === sh.user && sh.user !== 'root' ? 'Changing password for ' + target + '.\nCurrent password: \n' : '') + 'New password: \nRetype new password: \n');
        sh.system.passwords[target] = 'changed-' + Date.now();
        asRoot(sh, () => sh.system.syncFiles(sh.fs));
        ctx.outln('passwd: password updated successfully');
        return 0;
    });

    // ---------------------------------------------------------------- user & group management
    function needRoot(ctx, what) {
        if (isRoot(ctx)) return false;
        ctx.err(ctx.name + ': Permission denied.\n' + ctx.name + ': cannot lock /etc/' + (what || 'passwd') + '; try again later.\n');
        return true;
    }
    function createUser(ctx, name, o) {
        const sys = ctx.sh.system;
        if (!/^[a-z_][a-z0-9_-]*\$?$/.test(name)) { ctx.err(ctx.name + ": invalid user name '" + name + "': use --badname to ignore\n"); return 3; }
        if (sys.userExists(name)) { ctx.err(ctx.name + ": user '" + name + "' already exists\n"); return 9; }
        const uid = o.uid !== undefined ? parseInt(o.uid, 10) : Math.max(1000, ...sys.users.filter((u) => u.uid < 60000).map((u) => u.uid)) + 1;
        let gid;
        if (o.group) {
            const g = sys.groups.find((x) => x.name === o.group || String(x.gid) === o.group);
            if (!g) { ctx.err(ctx.name + ": group '" + o.group + "' does not exist\n"); return 6; }
            gid = g.gid;
        } else {
            gid = uid;
            while (sys.groups.some((g) => g.gid === gid)) gid++;
            sys.groups.push({ name, gid, members: [] });
        }
        for (const g of o.groups || []) {
            const grp = sys.groups.find((x) => x.name === g);
            if (!grp) { ctx.err(ctx.name + ": group '" + g + "' does not exist\n"); return 6; }
            if (!grp.members.includes(name)) grp.members.push(name);
        }
        const home = o.home || '/home/' + name;
        sys.users.push({ name, uid, gid, home, shell: o.shell || (ctx.name === 'adduser' ? '/bin/bash' : '/bin/sh'), gecos: o.comment || '' });
        asRoot(ctx.sh, () => {
            if (o.createHome && !ctx.fs.exists(home)) {
                ctx.fs.mkdir(home, { parents: true });
                const hn = ctx.fs.get(home);
                hn.owner = name; hn.group = sys.primaryGroupOf(name); hn.mode = 0o750;
                for (const f of ['.bashrc', '.profile']) {
                    if (ctx.fs.isFile('/etc/skel/' + f)) { const n = ctx.fs.writeFile(home + '/' + f, ctx.fs.readFile('/etc/skel/' + f)); n.owner = name; n.group = sys.primaryGroupOf(name); }
                }
            }
            sys.syncFiles(ctx.fs);
        });
        return 0;
    }
    R('useradd', (ctx) => {
        if (needRoot(ctx)) return 1;
        const { opts, operands, error } = getopt(ctx.args, { flags: 'mMrUN', args: 'dsgGucep', long: { 'create-home': 'm', home: 'd=', 'home-dir': 'd=', shell: 's=', gid: 'g=', groups: 'G=', uid: 'u=', comment: 'c=', system: 'r' } });
        if (error) return usageError(ctx, error);
        if (operands.length !== 1) return usageError(ctx, 'Usage: useradd [options] LOGIN');
        return createUser(ctx, operands[0], { createHome: opts.m, home: opts.d, shell: opts.s, group: opts.g, groups: opts.G ? opts.G.split(',') : [], uid: opts.u, comment: opts.c });
    });
    R('adduser', (ctx) => {
        if (!isRoot(ctx)) { ctx.err('fatal: Only root may add a user or group to the system.\n'); return 1; }
        const ops = ctx.args.filter((a) => !a.startsWith('-'));
        const flags = ctx.args.filter((a) => a.startsWith('-'));
        if (ops.length === 2 && !flags.length) {
            // adduser USER GROUP
            const sys = ctx.sh.system;
            const g = sys.groups.find((x) => x.name === ops[1]);
            if (!sys.userExists(ops[0])) return ctx.fail("The user `" + ops[0] + "' does not exist.");
            if (!g) return ctx.fail("The group `" + ops[1] + "' does not exist.");
            if (!g.members.includes(ops[0])) g.members.push(ops[0]);
            asRoot(ctx.sh, () => sys.syncFiles(ctx.fs));
            ctx.outln("info: Adding user `" + ops[0] + "' to group `" + ops[1] + "' ...\ninfo: Done.");
            if (ops[0] === ctx.sh.user || ctx.sh.userStack.some((s) => s.user === ops[0])) ctx.sh.applyUser();
            return 0;
        }
        const name = ops[0];
        if (!name) return ctx.fail('Only one or two names allowed.');
        const r = createUser(ctx, name, { createHome: true, shell: '/bin/bash' });
        if (r) return r;
        const u = ctx.sh.system.getUser(name);
        ctx.outln("info: Adding user `" + name + "' ...\ninfo: Selecting UID/GID from range 1000 to 59999 ...\ninfo: Adding new group `" + name + "' (" + u.gid + ") ...\ninfo: Adding new user `" + name + "' (" + u.uid + ") with group `" + name + " (" + u.gid + ")' ...\ninfo: Creating home directory `/home/" + name + "' ...\ninfo: Copying files from `/etc/skel' ...\npasswd: password updated successfully\ninfo: Adding new user `" + name + "' to supplemental / extra groups `users' ...\ninfo: Adding user `" + name + "' to group `users' ...");
        const users = ctx.sh.system.groups.find((g) => g.name === 'users');
        if (users && !users.members.includes(name)) users.members.push(name);
        asRoot(ctx.sh, () => ctx.sh.system.syncFiles(ctx.fs));
        return 0;
    });
    function deleteUser(ctx, removeHome) {
        const sys = ctx.sh.system;
        const name = ctx.args.filter((a) => !a.startsWith('-'))[0];
        if (!name) return usageError(ctx, 'Usage: ' + ctx.name + ' [options] LOGIN');
        const u = sys.getUser(name);
        if (!u) return ctx.fail("user '" + name + "' does not exist", 6);
        if (name === ctx.sh.user || name === 'root') return ctx.fail('user ' + name + ' is currently used by process 1002', 8);
        sys.users = sys.users.filter((x) => x.name !== name);
        for (const g of sys.groups) g.members = g.members.filter((m) => m !== name);
        sys.groups = sys.groups.filter((g) => !(g.name === name && g.gid === u.gid));
        asRoot(ctx.sh, () => {
            if (removeHome && ctx.fs.exists(u.home)) ctx.fs.rmrf(u.home);
            sys.syncFiles(ctx.fs);
        });
        if (ctx.name === 'deluser') ctx.outln("info: Removing user `" + name + "' ...\ninfo: Done.");
        return 0;
    }
    R('userdel', (ctx) => { if (needRoot(ctx)) return 1; return deleteUser(ctx, ctx.args.includes('-r') || ctx.args.includes('--remove')); });
    R('deluser', (ctx) => { if (!isRoot(ctx)) return ctx.fail('Only root may remove a user or group from the system.'); return deleteUser(ctx, ctx.args.includes('--remove-home')); });
    R('usermod', (ctx) => {
        if (needRoot(ctx)) return 1;
        const { opts, operands, error } = getopt(ctx.args, { flags: 'aLUm', args: 'GgsdlcLu', long: { append: 'a', groups: 'G=', gid: 'g=', shell: 's=', home: 'd=', login: 'l=', comment: 'c=', lock: 'L', unlock: 'U' } });
        if (error) return usageError(ctx, error);
        const sys = ctx.sh.system;
        const name = operands[0];
        const u = name && sys.getUser(name);
        if (!u) return ctx.fail("user '" + (name || '') + "' does not exist", 6);
        if (opts.G !== undefined) {
            const groups = opts.G.split(',').filter(Boolean);
            for (const g of groups) if (!sys.groupExists(g)) return ctx.fail("group '" + g + "' does not exist", 6);
            if (!opts.a) for (const g of sys.groups) g.members = g.members.filter((m) => m !== name);
            for (const g of groups) { const grp = sys.groups.find((x) => x.name === g); if (!grp.members.includes(name)) grp.members.push(name); }
        }
        if (opts.g) { const g = sys.groups.find((x) => x.name === opts.g || String(x.gid) === opts.g); if (!g) return ctx.fail("group '" + opts.g + "' does not exist", 6); u.gid = g.gid; }
        if (opts.s) u.shell = opts.s;
        if (opts.d) u.home = opts.d;
        if (opts.c) u.gecos = opts.c;
        if (opts.L) sys.passwords[name] = null;
        if (opts.l) { if (sys.userExists(opts.l)) return ctx.fail("user '" + opts.l + "' already exists", 9); for (const g of sys.groups) g.members = g.members.map((m) => (m === name ? opts.l : m)); u.name = opts.l; }
        asRoot(ctx.sh, () => sys.syncFiles(ctx.fs));
        ctx.sh.applyUser();
        return 0;
    });
    R('groupadd', (ctx) => {
        if (needRoot(ctx, 'group')) return 1;
        const { opts, operands } = getopt(ctx.args, { flags: 'rf', args: 'g' });
        const sys = ctx.sh.system;
        const name = operands[0];
        if (!name) return usageError(ctx, 'Usage: groupadd [options] GROUP');
        if (sys.groupExists(name)) { if (opts.f) return 0; return ctx.fail("group '" + name + "' already exists", 9); }
        let gid = opts.g ? parseInt(opts.g, 10) : Math.max(1000, ...sys.groups.filter((g) => g.gid < 60000).map((g) => g.gid)) + 1;
        sys.groups.push({ name, gid, members: [] });
        asRoot(ctx.sh, () => sys.syncFiles(ctx.fs));
        return 0;
    });
    R('groupdel', (ctx) => {
        if (needRoot(ctx, 'group')) return 1;
        const sys = ctx.sh.system;
        const name = ctx.args[0];
        if (!sys.groupExists(name)) return ctx.fail("group '" + name + "' does not exist", 6);
        if (sys.users.some((u) => sys.primaryGroupOf(u.name) === name)) return ctx.fail("cannot remove the primary group of user '" + sys.users.find((u) => sys.primaryGroupOf(u.name) === name).name + "'", 8);
        sys.groups = sys.groups.filter((g) => g.name !== name);
        asRoot(ctx.sh, () => sys.syncFiles(ctx.fs));
        return 0;
    });
    R('gpasswd', (ctx) => {
        const sys = ctx.sh.system;
        const a = ctx.args;
        if (!isRoot(ctx)) return ctx.fail('Permission denied.', 3);
        const g = sys.groups.find((x) => x.name === a[a.length - 1]);
        if (!g) return ctx.fail("group '" + a[a.length - 1] + "' does not exist in /etc/group", 3);
        if (a[0] === '-a') { if (!g.members.includes(a[1])) g.members.push(a[1]); ctx.outln('Adding user ' + a[1] + ' to group ' + g.name); }
        else if (a[0] === '-d') { g.members = g.members.filter((m) => m !== a[1]); ctx.outln('Removing user ' + a[1] + ' from group ' + g.name); }
        asRoot(ctx.sh, () => sys.syncFiles(ctx.fs));
        ctx.sh.applyUser();
        return 0;
    });
    R('getent', (ctx) => {
        const db = ctx.args[0];
        const keys = ctx.args.slice(1);
        const files = { passwd: '/etc/passwd', group: '/etc/group', hosts: '/etc/hosts', services: '/etc/services', shadow: '/etc/shadow' };
        if (!files[db]) return ctx.fail('Unknown database: ' + (db || ''), 1);
        if (db === 'shadow' && !isRoot(ctx)) return 2;
        let lines = splitLines(asRoot(ctx.sh, () => ctx.fs.readFile(files[db])));
        if (db === 'hosts' && keys.length) {
            let ok = false;
            for (const k of keys) {
                const ip = LA.NET.HOSTS[k];
                if (ip) { ctx.outln(ip.padEnd(16) + k); ok = true; }
            }
            return ok ? 0 : 2;
        }
        if (keys.length) lines = lines.filter((l) => keys.includes(l.split(/[:\s]/)[0]));
        for (const l of lines) ctx.outln(l);
        return lines.length ? 0 : 2;
    });

    // ---------------------------------------------------------------- services
    function unitName(n) { return String(n || '').replace(/\.service$/, ''); }
    function serviceStatus(ctx, name) {
        const sys = ctx.sh.system;
        const svc = sys.services[name];
        const C = U.C;
        const dot = ctx.tty ? (svc.active ? C.bgreen + '●' + C.reset : svc.failed ? C.bred + '×' + C.reset : '○') : (svc.active ? '●' : svc.failed ? '×' : '○');
        const since = new Date(svc.since || sys.bootTime + 30000);
        const ago = Math.floor((Date.now() - since.getTime()) / 1000);
        const agoTxt = ago > 86400 ? Math.floor(ago / 86400) + ' days ago' : ago > 3600 ? Math.floor(ago / 3600) + 'h ago' : ago > 60 ? Math.floor(ago / 60) + 'min ago' : ago + 's ago';
        const lines = [];
        lines.push(dot + ' ' + name + '.service - ' + svc.desc);
        lines.push('     Loaded: loaded (/usr/lib/systemd/system/' + name + '.service; ' + (svc.enabled ? 'enabled' : 'disabled') + '; preset: enabled)');
        let active;
        if (svc.active) active = (ctx.tty ? C.bgreen : '') + 'active (running)' + (ctx.tty ? C.reset : '');
        else if (svc.failed) active = (ctx.tty ? C.bred : '') + 'failed (Result: exit-code)' + (ctx.tty ? C.reset : '');
        else active = 'inactive (dead)';
        lines.push('     Active: ' + active + ' since ' + U.strftime('%a %Y-%m-%d %H:%M:%S UTC', since) + '; ' + agoTxt);
        if (svc.active && svc.procs.length) {
            const procs = sys.processes.filter((p) => p.service === name);
            lines.push('   Main PID: ' + svc.pidBase + ' (' + comm(svc.procs[0][1]) + ')');
            lines.push('      Tasks: ' + procs.length + ' (limit: 9387)');
            lines.push('     Memory: ' + (4 + procs.length * 1.7).toFixed(1) + 'M (peak: ' + (5 + procs.length * 1.7).toFixed(1) + 'M)');
            lines.push('        CPU: ' + (40 + procs.length * 6) + 'ms');
            lines.push('     CGroup: /system.slice/' + name + '.service');
            procs.forEach((p, i) => lines.push('             ' + (i === procs.length - 1 ? '└─' : '├─') + p.pid + ' "' + p.cmd + '"'));
        }
        const logs = sys.journal.filter((j) => j.unit === name).slice(-3);
        if (logs.length) {
            lines.push('');
            for (const j of logs) lines.push(U.strftime('%b %d %H:%M:%S', new Date(j.t)) + ' ' + sys.hostname + ' systemd[1]: ' + j.msg);
        }
        return lines.join('\n');
    }
    R('systemctl', (ctx) => {
        const sh = ctx.sh;
        const sys = sh.system;
        const flags = ctx.args.filter((a) => a.startsWith('-'));
        const ops = ctx.args.filter((a) => !a.startsWith('-'));
        const verb = ops[0] || 'list-units';
        const units = ops.slice(1).map(unitName);
        const deny = (v, u) => { ctx.err('Failed to ' + v + ' ' + u + '.service: Interactive authentication required.\nSee system logs and \'systemctl status ' + u + '.service\' for details.\n'); return 1; };
        const exists = (u) => !!sys.services[u];
        const notFound = (v, u) => { ctx.err((v === 'status' ? 'Unit ' + u + '.service could not be found.' : 'Failed to ' + v + ' ' + u + '.service: Unit ' + u + '.service not found.') + '\n'); return v === 'status' ? 4 : 5; };
        switch (verb) {
            case 'status': {
                if (!units.length) {
                    ctx.outln('● ' + sys.hostname + '\n    State: running\n    Units: 284 loaded (incl. loaded aliases)\n     Jobs: 0 queued\n   Failed: ' + Object.values(sys.services).filter((s) => s.failed).length + ' units\n    Since: ' + U.strftime('%a %Y-%m-%d %H:%M:%S UTC', new Date(sys.bootTime)) + '\n  systemd: 255.4-1ubuntu8\n   CGroup: /\n           ├─init.scope\n           │ └─1 /sbin/init splash\n           ├─system.slice\n' + Object.keys(sys.services).filter((k) => sys.services[k].active).map((k) => '           │ ├─' + k + '.service').join('\n') + '\n           └─user.slice\n             └─user-1000.slice');
                    return 0;
                }
                let code = 0;
                units.forEach((u, i) => {
                    if (!exists(u)) { code = notFound('status', u); return; }
                    if (i) ctx.outln('');
                    ctx.outln(serviceStatus(ctx, u));
                    if (!sys.services[u].active) code = 3;
                });
                return code;
            }
            case 'start': case 'stop': case 'restart': case 'reload': case 'try-restart': case 'reload-or-restart': {
                if (!units.length) return ctx.fail('Too few arguments.');
                for (const u of units) {
                    if (!exists(u)) return notFound(verb, u);
                    if (!isRoot(ctx)) return deny(verb, u);
                    const svc = sys.services[u];
                    if (verb === 'start') { if (!svc.active) sys.startService(u); }
                    else if (verb === 'stop') { if (svc.active) sys.stopService(u); svc.failed = false; }
                    else if (verb === 'reload') { if (!svc.active) { ctx.err('Job for ' + u + '.service invalid.\n'); return 1; } sys.log(u, 'Reloaded ' + svc.desc + '.'); }
                    else { if (svc.active) sys.stopService(u); sys.startService(u); }
                }
                return 0;
            }
            case 'enable': case 'disable': {
                if (!units.length) return ctx.fail('Too few arguments.');
                for (const u of units) {
                    if (!exists(u)) return notFound(verb, u);
                    if (!isRoot(ctx)) { ctx.err('Failed to ' + verb + ' unit: Interactive authentication required.\n'); return 1; }
                    const svc = sys.services[u];
                    if (verb === 'enable') {
                        if (!svc.enabled) ctx.err('Synchronizing state of ' + u + '.service with SysV service script with /usr/lib/systemd/systemd-sysv-install.\nExecuting: /usr/lib/systemd/systemd-sysv-install enable ' + u + '\nCreated symlink /etc/systemd/system/multi-user.target.wants/' + u + '.service → /usr/lib/systemd/system/' + u + '.service.\n');
                        svc.enabled = true;
                        if (flags.includes('--now') && !svc.active) sys.startService(u);
                    } else {
                        if (svc.enabled) ctx.err('Removed "/etc/systemd/system/multi-user.target.wants/' + u + '.service".\n');
                        svc.enabled = false;
                        if (flags.includes('--now') && svc.active) sys.stopService(u);
                    }
                }
                return 0;
            }
            case 'is-active': {
                let code = 0;
                for (const u of units) { const s = sys.services[u]; const st = !s ? 'inactive' : s.active ? 'active' : s.failed ? 'failed' : 'inactive'; if (!flags.includes('--quiet') && !flags.includes('-q')) ctx.outln(st); if (st !== 'active') code = 3; }
                return code;
            }
            case 'is-enabled': {
                let code = 0;
                for (const u of units) { const s = sys.services[u]; if (!s) { ctx.err('Failed to get unit file state for ' + u + '.service: No such file or directory\n'); code = 1; continue; } ctx.outln(s.enabled ? 'enabled' : 'disabled'); if (!s.enabled) code = 1; }
                return code;
            }
            case 'is-failed': {
                let code = 1;
                for (const u of units) { const s = sys.services[u]; const f = s && s.failed; ctx.outln(f ? 'failed' : s && s.active ? 'active' : 'inactive'); if (f) code = 0; }
                return code;
            }
            case 'list-units': {
                const stateFilter = (flags.find((f) => f.startsWith('--state=')) || '').split('=')[1];
                ctx.outln('  UNIT                            LOAD   ACTIVE SUB     DESCRIPTION');
                let n = 0;
                for (const [k, s] of Object.entries(sys.services).sort()) {
                    const sub = s.active ? 'running' : s.failed ? 'failed' : 'dead';
                    const act = s.active ? 'active' : s.failed ? 'failed' : 'inactive';
                    if (!flags.includes('--all') && !flags.includes('-a') && !s.active && !s.failed && !stateFilter) continue;
                    if (stateFilter && stateFilter !== sub && stateFilter !== act) continue;
                    ctx.outln((s.failed ? '● ' : '  ') + (k + '.service').padEnd(32) + ' loaded ' + act.padEnd(6) + ' ' + sub.padEnd(7) + ' ' + s.desc);
                    n++;
                }
                ctx.outln('\nLegend: LOAD   → Reflects whether the unit definition was properly loaded.\n        ACTIVE → The high-level unit activation state, i.e. generalization of SUB.\n        SUB    → The low-level unit activation state, values depend on unit type.\n\n' + n + ' loaded units listed.');
                return 0;
            }
            case 'list-unit-files': {
                ctx.outln('UNIT FILE                        STATE    PRESET');
                for (const [k, s] of Object.entries(sys.services).sort()) ctx.outln((k + '.service').padEnd(32) + ' ' + (s.enabled ? 'enabled ' : 'disabled') + ' enabled');
                ctx.outln('\n' + Object.keys(sys.services).length + ' unit files listed.');
                return 0;
            }
            case 'daemon-reload': return isRoot(ctx) ? 0 : (ctx.err('Failed to reload daemon: Interactive authentication required.\n'), 1);
            case 'reboot': case 'poweroff': case 'halt': ctx.name = verb; return powerCmd(ctx);
            case 'list-timers': ctx.outln('NEXT                        LEFT          LAST                        PASSED       UNIT                         ACTIVATES\nThu 2026-11-05 00:00:00 UTC 14h left      Wed 2026-11-04 00:00:00 UTC 9h ago       logrotate.timer              logrotate.service\nThu 2026-11-05 06:25:00 UTC 20h left      Wed 2026-11-04 06:25:00 UTC 3h ago       apt-daily-upgrade.timer      apt-daily-upgrade.service\n\n2 timers listed.'); return 0;
            case 'show': { const u = units[0]; const s = sys.services[u]; if (!s) return notFound('show', u); ctx.outln('Id=' + u + '.service\nDescription=' + s.desc + '\nLoadState=loaded\nActiveState=' + (s.active ? 'active' : 'inactive') + '\nSubState=' + (s.active ? 'running' : 'dead') + '\nUnitFileState=' + (s.enabled ? 'enabled' : 'disabled') + '\nMainPID=' + (s.active ? s.pidBase : 0)); return 0; }
            case 'cat': { const u = units[0]; const s = sys.services[u]; if (!s) return notFound('cat', u); ctx.outln('# /usr/lib/systemd/system/' + u + '.service\n[Unit]\nDescription=' + s.desc + '\nAfter=network.target\n\n[Service]\nType=forking\nExecStart=/usr/sbin/' + u + '\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target'); return 0; }
        }
        return ctx.fail('Unknown command verb \'' + verb + "'.");
    });
    R('service', (ctx) => {
        const sys = ctx.sh.system;
        if (ctx.args[0] === '--status-all') {
            for (const [k, s] of Object.entries(sys.services).sort()) ctx.outln(' [ ' + (s.active ? '+' : '-') + ' ]  ' + k);
            return 0;
        }
        const [name, action] = ctx.args;
        if (!name || !action) return ctx.fail('Usage: service < option > | --status-all | [ service_name [ command | --full-restart ] ]');
        if (!sys.services[name]) return ctx.fail(name + ': unrecognized service');
        return ctx.exec(['systemctl', action, name]);
    });
    R('journalctl', (ctx) => {
        const { opts, error } = getopt(ctx.args, { flags: 'fbkxer', args: 'unp', long: { unit: 'u=', lines: 'n=', priority: 'p=', since: 'since=', 'no-pager': 'nopager', follow: 'f', reverse: 'r' } });
        if (error) return usageError(ctx, error);
        const sys = ctx.sh.system;
        let lines = splitLines(asRoot(ctx.sh, () => ctx.fs.readFile('/var/log/syslog')));
        for (const j of sys.journal) lines.push(U.strftime('%b %e %H:%M:%S', new Date(j.t)) + ' ' + sys.hostname + ' systemd[1]: ' + j.msg);
        if (opts.u) { const u = unitName(opts.u); lines = lines.filter((l) => l.includes(u)); }
        if (opts.k) lines = lines.filter((l) => l.includes('kernel'));
        if (opts.p) { const pr = String(opts.p); if (/^(err|3|crit|2|alert|1|emerg|0)$/.test(pr)) lines = lines.filter((l) => /error|fail|killed|FAILURE/i.test(l)); else if (/^(warning|4)$/.test(pr)) lines = lines.filter((l) => /warn|error|fail/i.test(l)); }
        if (opts.r) lines.reverse();
        if (opts.n) lines = lines.slice(-parseInt(opts.n, 10));
        if (!lines.length) { ctx.outln('-- No entries --'); return 0; }
        if (!opts.n && !opts.u) ctx.outln('Nov 01 08:00:01 ' + sys.hostname + ' kernel: Linux version ' + KERNEL);
        for (const l of lines) ctx.outln(l.replace(/^(\w{3})\s+(\d)\s/, '$1 0$2 '));
        return 0;
    });

    // ---------------------------------------------------------------- cron
    R('crontab', (ctx) => {
        const sh = ctx.sh;
        const sys = sh.system;
        const { opts, operands, error } = getopt(ctx.args, { flags: 'lerin', args: 'u' });
        if (error) return usageError(ctx, error);
        let user = sh.user;
        if (opts.u) { if (!isRoot(ctx) && opts.u !== sh.user) return ctx.fail('must be privileged to use -u'); user = opts.u; }
        const path = '/var/spool/cron/crontabs/' + user;
        const save = (content) => {
            sys.crontabs[user] = content;
            asRoot(sh, () => { const n = ctx.fs.writeFile(path, content); n.owner = user; n.group = 'crontab'; n.mode = 0o600; });
        };
        if (opts.l) {
            const c = sys.crontabs[user];
            if (!c) { ctx.err('no crontab for ' + user + '\n'); return 1; }
            ctx.out(c);
            return 0;
        }
        if (opts.r) {
            if (!sys.crontabs[user]) { ctx.err('no crontab for ' + user + '\n'); return 1; }
            sys.crontabs[user] = '';
            asRoot(sh, () => { if (ctx.fs.exists(path)) ctx.fs.unlink(path); });
            return 0;
        }
        if (opts.e) {
            const content = sys.crontabs[user] || '# Edit this file to introduce tasks to be run by cron.\n#\n# m h  dom mon dow   command\n';
            if (sh.ui && sh.ui.openEditor && ctx.tty) {
                if (!sys.crontabs[user]) ctx.outln('no crontab for ' + user + ' - using an empty one');
                sh.ui.openEditor({
                    path: '/tmp/crontab.' + Math.random().toString(36).slice(2, 8) + '/crontab', content, mode: (sh.getVar('EDITOR') || 'nano').includes('vi') ? 'vim' : 'nano',
                    onSave: (text) => {
                        const bad = validateCron(text);
                        if (bad) return 'crontab: errors in crontab file, can\'t install: ' + bad;
                        save(text);
                        return 'crontab: installing new crontab';
                    }
                });
                return 0;
            }
            return ctx.fail('no terminal available for the editor. Install a crontab from a file instead: crontab FILE');
        }
        const src = operands[0];
        if (!src) return usageError(ctx, 'usage error: file name or - (for stdin) must be specified');
        let content;
        try { content = src === '-' ? ctx.stdin.readAll() : ctx.fs.readFile(ctx.resolve(src)); }
        catch (e) { return ctx.fail(src + ': ' + e.message); }
        const bad = validateCron(content);
        if (bad) { ctx.err('"' + src + '":1: ' + bad + '\nerrors in crontab file, can\'t install.\n'); return 1; }
        save(content);
        return 0;
    });
    function validateCron(text) {
        for (const line of splitLines(text)) {
            const l = line.trim();
            if (!l || l.startsWith('#') || /^[A-Z_]+=/.test(l)) continue;
            if (/^@(reboot|yearly|annually|monthly|weekly|daily|midnight|hourly)\s+\S/.test(l)) continue;
            const parts = l.split(/\s+/);
            if (parts.length < 6) return 'bad minute';
            const field = /^(\*|\d+(-\d+)?)(\/\d+)?(,(\*|\d+(-\d+)?)(\/\d+)?)*$/;
            const names = ['minute', 'hour', 'day-of-month', 'month', 'day-of-week'];
            for (let i = 0; i < 5; i++) if (!field.test(parts[i]) && !(i >= 3 && /^[a-z]{3}(-[a-z]{3})?(,[a-z]{3})*$/i.test(parts[i]))) return 'bad ' + names[i];
        }
        return null;
    }
    LA.validateCron = validateCron;

    // ---------------------------------------------------------------- packages
    function pkgInstall(ctx, names, sim) {
        const sh = ctx.sh, sys = sh.system;
        const fresh = [];
        for (const n of names) {
            const p = LA.PACKAGES[n];
            if (!p) { ctx.err('E: Unable to locate package ' + n + '\n'); return 100; }
            if (sys.packages[n]) ctx.outln(n + ' is already the newest version (' + p.v + ').');
            else fresh.push(n);
        }
        if (!fresh.length) { ctx.outln('0 upgraded, 0 newly installed, 0 to remove and 3 not upgraded.'); return 0; }
        const kb = fresh.reduce((a, n) => a + LA.PACKAGES[n].size, 0);
        ctx.outln('The following NEW packages will be installed:\n  ' + fresh.join(' '));
        ctx.outln('0 upgraded, ' + fresh.length + ' newly installed, 0 to remove and 3 not upgraded.');
        ctx.outln('Need to get ' + (kb / 4).toFixed(1) + ' kB of archives.\nAfter this operation, ' + kb + ' kB of additional disk space will be used.');
        if (sim) return 0;
        fresh.forEach((n, i) => ctx.outln('Get:' + (i + 1) + ' http://archive.ubuntu.com/ubuntu noble/universe amd64 ' + n + ' amd64 ' + LA.PACKAGES[n].v + ' [' + (LA.PACKAGES[n].size / 4).toFixed(1) + ' kB]'));
        ctx.outln('Fetched ' + (kb / 4).toFixed(1) + ' kB in 1s (' + (kb / 3).toFixed(0) + ' kB/s)');
        for (const n of fresh) {
            const p = LA.PACKAGES[n];
            ctx.outln('Selecting previously unselected package ' + n + '.\n(Reading database ... 74213 files and directories currently installed.)\nPreparing to unpack .../' + n + '_' + p.v + '_amd64.deb ...\nUnpacking ' + n + ' (' + p.v + ') ...');
        }
        for (const n of fresh) {
            const p = LA.PACKAGES[n];
            sys.packages[n] = true;
            asRoot(sh, () => {
                for (const c of p.cmds || []) {
                    const node = ctx.fs.writeFile('/usr/bin/' + c, '#!LA-BUILTIN ' + c + '\n');
                    node.mode = 0o755;
                }
            });
            ctx.outln('Setting up ' + n + ' (' + p.v + ') ...');
            asRoot(sh, () => ctx.fs.writeFile('/var/log/apt/history.log', '\nStart-Date: ' + U.isoDate(Date.now()) + '\nCommandline: apt install ' + n + '\nInstall: ' + n + ':amd64 (' + p.v + ')\nEnd-Date: ' + U.isoDate(Date.now()) + '\n', { append: true }));
        }
        ctx.outln('Processing triggers for man-db (2.12.0-4build2) ...');
        return 0;
    }
    function pkgRemove(ctx, names, purge) {
        const sh = ctx.sh, sys = sh.system;
        const gone = [];
        for (const n of names) {
            if (!LA.PACKAGES[n]) { ctx.err('E: Unable to locate package ' + n + '\n'); return 100; }
            if (!sys.packages[n]) { ctx.outln('Package \'' + n + '\' is not installed, so not removed'); continue; }
            gone.push(n);
        }
        if (!gone.length) { ctx.outln('0 upgraded, 0 newly installed, 0 to remove and 3 not upgraded.'); return 0; }
        ctx.outln('The following packages will be REMOVED:\n  ' + gone.map((n) => n + (purge ? '*' : '')).join(' ') + '\n0 upgraded, 0 newly installed, ' + gone.length + ' to remove and 3 not upgraded.');
        for (const n of gone) {
            sys.packages[n] = false;
            asRoot(sh, () => { for (const c of LA.PACKAGES[n].cmds || []) if (ctx.fs.exists('/usr/bin/' + c)) ctx.fs.unlink('/usr/bin/' + c); });
            ctx.outln('Removing ' + n + ' (' + LA.PACKAGES[n].v + ') ...');
            if (purge) ctx.outln('Purging configuration files for ' + n + ' (' + LA.PACKAGES[n].v + ') ...');
        }
        return 0;
    }
    function aptCmd(ctx) {
        const sh = ctx.sh, sys = sh.system;
        const flags = ctx.args.filter((a) => a.startsWith('-'));
        const ops = ctx.args.filter((a) => !a.startsWith('-'));
        const verb = ops[0];
        const names = ops.slice(1);
        const needsRoot = ['update', 'upgrade', 'install', 'remove', 'purge', 'autoremove', 'full-upgrade', 'dist-upgrade', 'reinstall'].includes(verb);
        if (needsRoot && !isRoot(ctx) && !flags.includes('-s') && !flags.includes('--simulate')) {
            if (verb === 'update') ctx.err('Reading package lists... Done\n');
            ctx.err('E: Could not open lock file /var/lib/' + (verb === 'update' ? 'apt/lists/lock' : 'dpkg/lock-frontend') + ' - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?\n');
            return 100;
        }
        const header = () => ctx.outln('Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done');
        switch (verb) {
            case 'update':
                ctx.outln('Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease\nGet:2 http://archive.ubuntu.com/ubuntu noble-updates InRelease [126 kB]\nGet:3 http://security.ubuntu.com/ubuntu noble-security InRelease [126 kB]\nFetched 252 kB in 1s (241 kB/s)\nReading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n3 packages can be upgraded. Run \'apt list --upgradable\' to see them.');
                sys.aptUpdated = true;
                return 0;
            case 'upgrade': case 'full-upgrade': case 'dist-upgrade':
                header();
                ctx.outln('Calculating upgrade... Done\nThe following packages will be upgraded:\n  curl libcurl4t64 openssl\n3 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\nNeed to get 2,147 kB of archives.\nSetting up openssl (3.0.13-0ubuntu3.4) ...\nSetting up libcurl4t64:amd64 (8.5.0-2ubuntu10.5) ...\nSetting up curl (8.5.0-2ubuntu10.5) ...');
                return 0;
            case 'install': case 'reinstall':
                if (!names.length) { header(); ctx.outln('0 upgraded, 0 newly installed, 0 to remove and 3 not upgraded.'); return 0; }
                header();
                return pkgInstall(ctx, names.map((n) => n.replace(/=.*$/, '')), flags.includes('-s') || flags.includes('--simulate'));
            case 'remove': case 'purge':
                header();
                return pkgRemove(ctx, names, verb === 'purge');
            case 'autoremove': header(); ctx.outln('0 upgraded, 0 newly installed, 0 to remove and 3 not upgraded.'); return 0;
            case 'search': {
                if (!names.length) return ctx.fail('E: You must give at least one search pattern', 100);
                ctx.outln('Sorting... Done\nFull Text Search... Done');
                const re = new RegExp(names.join('|'), 'i');
                for (const [n, p] of Object.entries(LA.PACKAGES).sort()) if (re.test(n) || re.test(p.d)) ctx.outln((ctx.tty ? U.C.green + n + U.C.reset : n) + '/noble ' + p.v + ' amd64' + (sys.packages[n] ? ' [installed]' : '') + '\n  ' + p.d + '\n');
                return 0;
            }
            case 'show': {
                const p = LA.PACKAGES[names[0]];
                if (!p) return ctx.fail('E: No packages found', 100);
                ctx.outln('Package: ' + names[0] + '\nVersion: ' + p.v + '\nPriority: optional\nSection: universe/utils\nOrigin: Ubuntu\nMaintainer: Ubuntu Developers <ubuntu-devel-discuss@lists.ubuntu.com>\nInstalled-Size: ' + p.size + ' kB\nDownload-Size: ' + (p.size / 4).toFixed(1) + ' kB\nAPT-Manual-Installed: ' + (sys.packages[names[0]] ? 'yes' : 'no') + '\nAPT-Sources: http://archive.ubuntu.com/ubuntu noble/universe amd64 Packages\nDescription: ' + p.d + '\n');
                return 0;
            }
            case 'list': {
                ctx.outln('Listing... Done');
                const inst = flags.includes('--installed');
                const upg = flags.includes('--upgradable');
                if (upg) { ctx.outln('curl/noble-updates 8.5.0-2ubuntu10.5 amd64 [upgradable from: 8.5.0-2ubuntu10]\nlibcurl4t64/noble-updates 8.5.0-2ubuntu10.5 amd64 [upgradable from: 8.5.0-2ubuntu10]\nopenssl/noble-updates 3.0.13-0ubuntu3.4 amd64 [upgradable from: 3.0.13-0ubuntu3]'); return 0; }
                for (const [n, p] of Object.entries(LA.PACKAGES).sort()) {
                    if (inst && !sys.packages[n]) continue;
                    if (names.length && !names.some((x) => LA.shellUtil.globMatch(x, n))) continue;
                    ctx.outln(n + '/noble,now ' + p.v + ' amd64' + (sys.packages[n] ? ' [installed]' : ''));
                }
                return 0;
            }
            case 'policy': {
                const p = LA.PACKAGES[names[0]];
                if (!p) return 0;
                ctx.outln(names[0] + ':\n  Installed: ' + (sys.packages[names[0]] ? p.v : '(none)') + '\n  Candidate: ' + p.v + '\n  Version table:\n     ' + p.v + ' 500\n        500 http://archive.ubuntu.com/ubuntu noble/universe amd64 Packages');
                return 0;
            }
            case 'clean': case 'autoclean': return 0;
            case undefined:
                ctx.outln('apt 2.7.14 (amd64)\nUsage: apt [options] command\n\nMost used commands:\n  list - list packages based on package names\n  search - search in package descriptions\n  show - show package details\n  install - install packages\n  reinstall - reinstall packages\n  remove - remove packages\n  autoremove - automatically remove all unused packages\n  update - update list of available packages\n  upgrade - upgrade the system by installing/upgrading packages\n  full-upgrade - upgrade the system by removing/installing/upgrading packages\n  edit-sources - edit the source information file');
                return 0;
        }
        return ctx.fail('E: Invalid operation ' + verb, 100);
    }
    R('apt', aptCmd);
    R('apt-get', aptCmd);
    R('apt-cache', (ctx) => { const v = ctx.args[0]; if (v === 'search' || v === 'show' || v === 'policy') return aptCmd(ctx); if (v === 'depends') { ctx.outln(ctx.args[1] + '\n  Depends: libc6'); return 0; } return ctx.fail('E: Invalid operation ' + v, 100); });
    R('dpkg', (ctx) => {
        const sys = ctx.sh.system;
        const a = ctx.args;
        if (a[0] === '-l' || a[0] === '--list') {
            ctx.outln('Desired=Unknown/Install/Remove/Purge/Hold\n| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend\n|/ Err?=(none)/Reinst-required (Status,Err: uppercase=bad)\n||/ Name                Version                         Architecture Description\n+++-===================-===============================-============-=================================');
            for (const [n, p] of Object.entries(LA.PACKAGES).sort()) {
                if (!sys.packages[n]) continue;
                if (a[1] && !LA.shellUtil.globMatch(a[1], n)) continue;
                ctx.outln('ii  ' + n.padEnd(19) + ' ' + p.v.slice(0, 31).padEnd(31) + ' amd64        ' + p.d.slice(0, 40));
            }
            return 0;
        }
        if (a[0] === '-s' || a[0] === '--status') {
            const p = LA.PACKAGES[a[1]];
            if (!p || !sys.packages[a[1]]) return ctx.fail("package '" + a[1] + "' is not installed and no information is available");
            ctx.outln('Package: ' + a[1] + '\nStatus: install ok installed\nPriority: optional\nInstalled-Size: ' + p.size + '\nVersion: ' + p.v + '\nDescription: ' + p.d);
            return 0;
        }
        if (a[0] === '-L' || a[0] === '--listfiles') {
            const p = LA.PACKAGES[a[1]];
            if (!p || !sys.packages[a[1]]) return ctx.fail("package '" + a[1] + "' is not installed");
            ctx.outln('/.\n/usr\n/usr/bin\n' + (p.cmds || []).map((c) => '/usr/bin/' + c).join('\n') + '\n/usr/share/doc/' + a[1] + '\n/usr/share/man/man1');
            return 0;
        }
        if (a[0] === '-S' || a[0] === '--search') {
            const cmd = VFS.basename(a[1] || '');
            const pkg = LA.PKG_OF_CMD[cmd] || 'coreutils';
            ctx.outln(pkg + ': /usr/bin/' + cmd);
            return 0;
        }
        if (a[0] === '-i') return isRoot(ctx) ? (ctx.outln('Selecting previously unselected package.\nUnpacking ...\nSetting up ...'), 0) : ctx.fail('error: requested operation requires superuser privilege', 2);
        return ctx.fail('need an action option\n\nType dpkg --help for help about installing and deinstalling packages [*];', 2);
    });
    R('snap', (ctx) => { if (ctx.args[0] === 'list') { ctx.outln('Name    Version   Rev    Tracking       Publisher   Notes\ncore22  20240904  1621   latest/stable  canonical✓  base\nsnapd   2.63      21759  latest/stable  canonical✓  snapd'); return 0; } return ctx.fail('snap support is limited in this sandbox; use apt instead'); });

    // ---------------------------------------------------------------- python (tiny subset)
    R('python3', (ctx) => {
        const a = ctx.args;
        if (a[0] === '--version' || a[0] === '-V') { ctx.outln('Python 3.12.3'); return 0; }
        let src = null;
        if (a[0] === '-c') src = a[1] || '';
        else if (a[0] && !a[0].startsWith('-')) {
            try { src = ctx.fs.readFile(ctx.resolve(a[0])); } catch (e) { return ctx.fail("can't open file '" + ctx.resolve(a[0]) + "': [Errno 2] No such file or directory", 2); }
            if (/while\s+True\s*:/.test(src)) { ctx.err('^C\nKeyboardInterrupt (the sandbox stopped an infinite loop)\n'); return 130; }
        } else if (!a.length && !ctx.stdin.eof) src = ctx.stdin.readAll();
        else if (a[0] === '-m' && a[1] === 'http.server') { ctx.outln('Serving HTTP on 0.0.0.0 port ' + (a[2] || 8000) + ' (http://0.0.0.0:' + (a[2] || 8000) + '/) ...\n(the sandbox has no real network; press Enter to continue)'); return 0; }
        else { ctx.outln('Python 3.12.3 (main, Sep 11 2024, 14:17:37) [GCC 13.2.0] on linux\nType "help", "copyright", "credits" or "license" for more information.\n(interactive Python is not available in the sandbox - use python3 -c "..." or run a script)'); return 0; }
        return runMiniPython(ctx, src);
    });
    LA.commands.python = LA.commands.python3;
    // A tiny, safe Python expression evaluator (no JavaScript eval): numbers, strings, arithmetic,
    // comparisons, and/or/not, variables, len/str/int/abs/max/min/round, .upper()/.lower()/.strip()
    function pyEval(expr, vars) {
        const toks = [];
        const re = /\s*(?:(\d+\.\d*|\.\d+|\d+)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([A-Za-z_]\w*)|(\*\*|\/\/|==|!=|<=|>=|[-+*\/%<>(),.]))/y;
        let m, pos = 0;
        const src = expr.trim();
        while (pos < src.length) {
            re.lastIndex = pos;
            m = re.exec(src);
            if (!m || m.index !== pos) throw new Error('invalid syntax');
            pos = re.lastIndex;
            if (m[1] !== undefined) toks.push({ t: 'num', v: parseFloat(m[1]), int: !m[1].includes('.') });
            else if (m[2] !== undefined) toks.push({ t: 'str', v: LA.shellUtil.unescapeC(m[2].slice(1, -1)) });
            else if (m[3] !== undefined) toks.push({ t: 'id', v: m[3] });
            else toks.push({ t: 'op', v: m[4] });
            while (pos < src.length && /\s/.test(src[pos])) pos++;
        }
        let i = 0;
        const peek = () => toks[i];
        const isOp = (v) => toks[i] && toks[i].t === 'op' && toks[i].v === v;
        const isId = (v) => toks[i] && toks[i].t === 'id' && toks[i].v === v;
        const FN = {
            len: (x) => (x == null ? 0 : String(x).length), str: (x) => pyStr(x), int: (x) => Math.trunc(Number(x)), float: (x) => Number(x),
            abs: Math.abs, max: (...a) => Math.max(...a), min: (...a) => Math.min(...a), round: (x, n) => (n ? Number(x.toFixed(n)) : Math.round(x))
        };
        function primary() {
            const t = toks[i++];
            if (!t) throw new Error('unexpected EOF while parsing');
            let v;
            if (t.t === 'num') v = t.v;
            else if (t.t === 'str') v = t.v;
            else if (t.t === 'op' && t.v === '(') { v = orE(); if (!isOp(')')) throw new Error("'(' was never closed"); i++; }
            else if (t.t === 'id') {
                if (t.v === 'True') v = true; else if (t.v === 'False') v = false; else if (t.v === 'None') v = null;
                else if (isOp('(') && FN[t.v]) {
                    i++;
                    const args = [];
                    while (!isOp(')')) { args.push(orE()); if (isOp(',')) i++; else if (!isOp(')')) throw new Error('invalid syntax'); }
                    i++;
                    v = FN[t.v](...args);
                } else if (Object.prototype.hasOwnProperty.call(vars, t.v)) v = vars[t.v];
                else throw new Error("NameError: name '" + t.v + "' is not defined");
            } else throw new Error('invalid syntax');
            while (isOp('.')) {
                i++;
                const meth = toks[i++];
                if (!meth || meth.t !== 'id' || !isOp('(')) throw new Error('invalid syntax');
                i++;
                if (!isOp(')')) throw new Error('unsupported method arguments');
                i++;
                const s = String(v);
                const methods = { upper: () => s.toUpperCase(), lower: () => s.toLowerCase(), strip: () => s.trim(), title: () => s.replace(/\b\w/g, (c) => c.toUpperCase()), capitalize: () => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() };
                if (!methods[meth.v]) throw new Error("AttributeError: 'str' object has no attribute '" + meth.v + "'");
                v = methods[meth.v]();
            }
            return v;
        }
        function unary() { if (isOp('-')) { i++; return -unary(); } if (isOp('+')) { i++; return +unary(); } return power(); }
        function power() { const b = primary(); if (isOp('**')) { i++; return Math.pow(b, unary()); } return b; }
        function mul() {
            let v = unary();
            while (isOp('*') || isOp('/') || isOp('//') || isOp('%')) {
                const op = toks[i++].v; const r = unary();
                if (op === '*') v = typeof v === 'string' ? v.repeat(r) : typeof r === 'string' ? r.repeat(v) : v * r;
                else if ((op === '/' || op === '//' || op === '%') && r === 0) throw new Error('ZeroDivisionError: division by zero');
                else if (op === '/') v = v / r; else if (op === '//') v = Math.floor(v / r); else v = ((v % r) + r) % r;
            }
            return v;
        }
        function add() {
            let v = mul();
            while (isOp('+') || isOp('-')) {
                const op = toks[i++].v; const r = mul();
                if (op === '+') { if ((typeof v === 'string') !== (typeof r === 'string')) throw new Error('TypeError: can only concatenate str (not "' + (typeof r === 'number' ? 'int' : 'str') + '") to str'); v = v + r; }
                else v = v - r;
            }
            return v;
        }
        function cmp() {
            let v = add();
            while (peek() && peek().t === 'op' && ['<', '>', '<=', '>=', '==', '!='].includes(peek().v)) {
                const op = toks[i++].v; const r = add();
                v = { '<': v < r, '>': v > r, '<=': v <= r, '>=': v >= r, '==': v === r, '!=': v !== r }[op];
            }
            return v;
        }
        function notE() { if (isId('not')) { i++; return !notE(); } return cmp(); }
        function andE() { let v = notE(); while (isId('and')) { i++; const r = notE(); v = v && r; } return v; }
        function orE() { let v = andE(); while (isId('or')) { i++; const r = andE(); v = v || r; } return v; }
        const result = orE();
        if (i < toks.length) throw new Error('invalid syntax');
        return result;
    }
    function pyStr(v) {
        if (v === true) return 'True';
        if (v === false) return 'False';
        if (v === null || v === undefined) return 'None';
        if (typeof v === 'number' && Number.isInteger(v) === false) return String(v);
        return String(v);
    }
    function runMiniPython(ctx, src) {
        const vars = Object.create(null);
        for (const raw of src.split('\n')) {
            const line = raw.replace(/#.*$/, '').trimEnd();
            if (!line.trim() || /^\s*(import|from)\s/.test(line) || /^\s*if\s+__name__/.test(line)) continue;
            let m;
            try {
                if ((m = /^\s*print\((.*)\)\s*$/.exec(line))) {
                    const inner = m[1].trim();
                    if (!inner) { ctx.outln(''); continue; }
                    const fstr = /^f(["'])(.*)\1$/.exec(inner);
                    if (fstr) { ctx.outln(fstr[2].replace(/\{([^}]+)\}/g, (x, e) => pyStr(pyEval(e, vars)))); continue; }
                    ctx.outln(splitArgs(inner).map((p) => pyStr(pyEval(p, vars))).join(' '));
                } else if ((m = /^\s*([A-Za-z_]\w*)\s*(\+|-|\*)?=\s*(.+)$/.exec(line)) && !/^[^=]*==/.test(line)) {
                    const val = pyEval(m[3], vars);
                    if (m[2]) { const cur = vars[m[1]]; vars[m[1]] = m[2] === '+' ? cur + val : m[2] === '-' ? cur - val : cur * val; }
                    else vars[m[1]] = val;
                } else if (/^\s*(def|class|for|while|if|elif|else|try|except|with|return)\b/.test(line)) {
                    ctx.err('python3: only simple statements (print, assignments, expressions) are supported in the sandbox\n');
                    return 1;
                } else pyEval(line, vars);
            } catch (e) {
                const msg = e.message || 'invalid syntax';
                ctx.err('Traceback (most recent call last):\n  File "<string>", line 1, in <module>\n' + (/Error:/.test(msg) ? msg : 'SyntaxError: ' + msg) + '\n');
                return 1;
            }
        }
        return 0;
    }
    function splitArgs(s) {
        const out = []; let depth = 0, cur = '', q = null;
        for (const c of s) {
            if (q) { cur += c; if (c === q) q = null; continue; }
            if (c === '"' || c === "'") { q = c; cur += c; continue; }
            if (c === '(' || c === '[') depth++;
            if (c === ')' || c === ']') depth--;
            if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
            cur += c;
        }
        if (cur.trim()) out.push(cur);
        return out;
    }

    // ---------------------------------------------------------------- editors
    function editor(mode) {
        return (ctx) => {
            const sh = ctx.sh;
            const files = ctx.args.filter((a) => !a.startsWith('-') && !a.startsWith('+'));
            const target = files[0];
            if (!ctx.tty || !sh.ui || !sh.ui.openEditor) {
                if (mode === 'vim') { ctx.err('Vim: Warning: Output is not to a terminal\nVim: Error reading input, exiting...\n'); return 1; }
                ctx.err('Error opening terminal: unknown.\n');
                return 1;
            }
            let content = '';
            let readonly = ctx.args.includes('-R') || ctx.name === 'view';
            let path = null;
            let isNew = true;
            if (target) {
                path = ctx.resolve(target);
                const node = ctx.fs.get(path);
                if (node && node.type === 'dir') { if (mode === 'nano') { ctx.err('Error reading ' + target + ': Is a directory\n'); return 1; } }
                else if (node) {
                    isNew = false;
                    if (!ctx.fs.can(node, 'r')) { if (mode === 'nano') { ctx.err('Error reading ' + target + ': Permission denied\n'); } content = ''; readonly = true; }
                    else content = node.content;
                    if (!ctx.fs.can(node, 'w')) readonly = true;
                }
            }
            sh.ui.openEditor({
                path, displayName: target || '', content, mode, readonly, isNew,
                onSave: (text, newPath) => {
                    const p = newPath ? ctx.resolve(newPath) : path;
                    if (!p) return { error: 'No file name' };
                    try { sh.fs.writeFile(p, text); }
                    catch (e) { return { error: (mode === 'nano' ? 'Error writing ' : '"' + target + '" E212: Can\'t open file for writing: ') + (mode === 'nano' ? p + ': ' + e.message : '') }; }
                    path = p;
                    return { ok: true, lines: text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0), bytes: VFS.utf8Length(text) };
                }
            });
            return 0;
        };
    }
    R('nano', editor('nano'));
    R('vim', editor('vim'));
    R('vi', editor('vim'));
    R('view', editor('vim'), { hidden: true });
    R('vim.tiny', editor('vim'), { hidden: true });
    R('editor', editor('nano'), { hidden: true });
    R('emacs', (ctx) => ctx.sh.commandNotFound('emacs', ctx.io) && 127, { hidden: true });

    // ---------------------------------------------------------------- fun stuff
    R('cowsay', (ctx) => {
        const think = ctx.name === 'cowthink';
        let args = ctx.args.slice();
        let eyes = 'oo', tongue = '  ';
        let figure = 'default';
        while (args[0] && args[0].startsWith('-')) {
            const a = args.shift();
            if (a === '-e') eyes = (args.shift() || 'oo').slice(0, 2);
            else if (a === '-T') tongue = (args.shift() || '  ').slice(0, 2);
            else if (a === '-f') figure = args.shift();
            else if (a === '-d') eyes = 'xx', tongue = 'U ';
            else if (a === '-l') { ctx.outln('Cow files in /usr/share/cowsay/cows:\ndefault tux dragon sheep'); return 0; }
        }
        let text = args.length ? args.join(' ') : ctx.stdin.readAll().replace(/\n$/, '');
        const words = text.split(/\s+/);
        const lines = [];
        let cur = '';
        for (const w of words) { if ((cur + ' ' + w).trim().length > 39) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
        lines.push(cur);
        const width = Math.max(...lines.map((l) => l.length));
        let out = ' ' + '_'.repeat(width + 2) + '\n';
        if (lines.length === 1) out += (think ? '( ' : '< ') + lines[0].padEnd(width) + (think ? ' )' : ' >') + '\n';
        else lines.forEach((l, i) => { const [o, c] = think ? ['(', ')'] : i === 0 ? ['/', '\\'] : i === lines.length - 1 ? ['\\', '/'] : ['|', '|']; out += o + ' ' + l.padEnd(width) + ' ' + c + '\n'; });
        out += ' ' + '-'.repeat(width + 2) + '\n';
        const t = think ? 'o' : '\\';
        if (figure === 'tux') out += '   ' + t + '\n    ' + t + '\n        .--.\n       |o_o |\n       |:_/ |\n      //   \\ \\\n     (|     | )\n    /\'\\_   _/`\\\n    \\___)=(___/\n';
        else if (figure === 'dragon') out += '      ' + t + '                    / \\  //\\\n       ' + t + '    |\\___/|      /   \\//  \\\\\n            /0  0  \\__  /    //  | \\ \\\n           /     /  \\/_/    //   |  \\  \\\n           @_^_@\'/   \\/_   //    |   \\   \\\n           //_^_/     \\/_ //     |    \\    \\\n        ( //) |        \\///      |     \\     \\\n';
        else if (figure === 'sheep') out += '  ' + t + '\n   ' + t + '\n       __\n      UooU\\.\'@@@@@@`.\n      \\__/(@@@@@@@@@@)\n           (@@@@@@@@)\n           `YY~~~~YY\'\n            ||    ||\n';
        else out += '        ' + t + '   ^__^\n         ' + t + '  (' + eyes + ')\\_______\n            (__)\\       )\\/\\\n             ' + tongue + ' ||----w |\n                ||     ||\n';
        ctx.out(out);
        return 0;
    }, { pkg: 'cowsay' });
    LA.commands.cowthink = { fn: (ctx) => { ctx.name = 'cowthink'; return LA.commands.cowsay.fn(ctx); }, pkg: 'cowsay' };

    const FONT = {
        A: ['  #  ', ' # # ', '#   #', '#####', '#   #'], B: ['#### ', '#   #', '#### ', '#   #', '#### '], C: [' ####', '#    ', '#    ', '#    ', ' ####'], D: ['#### ', '#   #', '#   #', '#   #', '#### '],
        E: ['#####', '#    ', '#### ', '#    ', '#####'], F: ['#####', '#    ', '#### ', '#    ', '#    '], G: [' ####', '#    ', '#  ##', '#   #', ' ####'], H: ['#   #', '#   #', '#####', '#   #', '#   #'],
        I: ['#####', '  #  ', '  #  ', '  #  ', '#####'], J: ['#####', '   # ', '   # ', '#  # ', ' ##  '], K: ['#   #', '#  # ', '###  ', '#  # ', '#   #'], L: ['#    ', '#    ', '#    ', '#    ', '#####'],
        M: ['#   #', '## ##', '# # #', '#   #', '#   #'], N: ['#   #', '##  #', '# # #', '#  ##', '#   #'], O: [' ### ', '#   #', '#   #', '#   #', ' ### '], P: ['#### ', '#   #', '#### ', '#    ', '#    '],
        Q: [' ### ', '#   #', '# # #', '#  # ', ' ## #'], R: ['#### ', '#   #', '#### ', '#  # ', '#   #'], S: [' ####', '#    ', ' ### ', '    #', '#### '], T: ['#####', '  #  ', '  #  ', '  #  ', '  #  '],
        U: ['#   #', '#   #', '#   #', '#   #', ' ### '], V: ['#   #', '#   #', '#   #', ' # # ', '  #  '], W: ['#   #', '#   #', '# # #', '## ##', '#   #'], X: ['#   #', ' # # ', '  #  ', ' # # ', '#   #'],
        Y: ['#   #', ' # # ', '  #  ', '  #  ', '  #  '], Z: ['#####', '   # ', '  #  ', ' #   ', '#####'], ' ': ['   ', '   ', '   ', '   ', '   '],
        0: [' ### ', '#  ##', '# # #', '##  #', ' ### '], 1: ['  #  ', ' ##  ', '  #  ', '  #  ', ' ### '], 2: [' ### ', '#   #', '  ## ', ' #   ', '#####'], 3: ['#### ', '    #', ' ### ', '    #', '#### '],
        4: ['#   #', '#   #', '#####', '    #', '    #'], 5: ['#####', '#    ', '#### ', '    #', '#### '], 6: [' ### ', '#    ', '#### ', '#   #', ' ### '], 7: ['#####', '    #', '   # ', '  #  ', '  #  '],
        8: [' ### ', '#   #', ' ### ', '#   #', ' ### '], 9: [' ### ', '#   #', ' ####', '    #', ' ### '], '!': ['#', '#', '#', ' ', '#'], '?': [' ### ', '#   #', '  ## ', '     ', '  #  '], '.': [' ', ' ', ' ', ' ', '#'],
        '-': ['    ', '    ', '####', '    ', '    '], '_': ['     ', '     ', '     ', '     ', '#####'], ':': [' ', '#', ' ', '#', ' '], '#': [' # # ', '#####', ' # # ', '#####', ' # # '], '@': [' ### ', '# ###', '# # #', '# ###', ' ### ']
    };
    R('figlet', (ctx) => {
        const text = (ctx.args.filter((a) => !a.startsWith('-')).join(' ') || ctx.stdin.readAll().trim()).toUpperCase();
        for (const line of text.split('\n')) {
            const rows = ['', '', '', '', ''];
            for (const ch of line) { const g = FONT[ch] || FONT['?']; for (let r = 0; r < 5; r++) rows[r] += g[r] + ' '; }
            ctx.out(rows.map((r) => r.trimEnd()).join('\n') + '\n\n');
        }
        return 0;
    }, { pkg: 'figlet' });
    LA.commands.banner = { fn: LA.commands.figlet.fn, hidden: true };
    const FORTUNES = [
        'There are 10 kinds of people: those who understand binary and those who don\'t.',
        '"Talk is cheap. Show me the code." -- Linus Torvalds',
        'UNIX is basically a simple operating system, but you have to be a genius to understand the simplicity. -- Dennis Ritchie',
        'Any sufficiently advanced bug is indistinguishable from a feature.',
        'To err is human; to really foul things up requires root.',
        'Never test for an error condition you don\'t know how to handle.',
        'Real programmers count from 0.',
        '"Intelligence is the ability to avoid doing work, yet getting the work done." -- Linus Torvalds',
        'In Linux we trust; everything else we grep.',
        'rm -rf: because sometimes you need a fresh start. (Never on /.)',
        'The best way to learn the command line is one command at a time.',
        'A clean desk is a sign of a cluttered drawer; a clean $HOME is a sign of a cluttered /tmp.'
    ];
    R('fortune', (ctx) => { ctx.outln(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]); return 0; }, { pkg: 'fortune-mod' });
    R('sl', (ctx) => {
        if (ctx.tty && ctx.sh.ui && ctx.sh.ui.openAnimation) { ctx.sh.ui.openAnimation('sl'); return 0; }
        ctx.out('      ====        ________                ___________\n  _D _|  |_______/        \\__I_I_____===__|_________|\n   |(_)---  |   H\\________/ |   |        =|___ ___|\n   /     |  |   H  |  |     |   |         ||_| |_||\n  |      |  |   H  |__--------------------| [___] |\n  | ________|___H__/__|_____/[][]~\\_______|       |\n  |/ |   |-----------I_____I [][] []  D   |=======|_\n__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__\n |/-=|___|=    ||    ||    ||    |_____/~\\___/\n  \\_/      \\O=====O=====O=====O_/      \\_/\n');
        return 0;
    }, { pkg: 'sl' });
    R('cmatrix', (ctx) => {
        if (ctx.tty && ctx.sh.ui && ctx.sh.ui.openAnimation) { ctx.sh.ui.openAnimation('matrix'); return 0; }
        return ctx.fail('cmatrix needs a terminal');
    }, { pkg: 'cmatrix' });
    R('neofetch', (ctx) => {
        const sh = ctx.sh;
        const c = ctx.tty ? (s) => '\x1b[1;31m' + s + '\x1b[0m' : (s) => s;
        const b = ctx.tty ? (s) => '\x1b[1;31m' + s + '\x1b[0m' : (s) => s;
        const logo = [
            '            .-/+oossssoo+/-.               ', '        `:+ssssssssssssssssss+:`           ', '      -+ssssssssssssssssssyyssss+-         ', '    .ossssssssssssssssssdMMMNysssso.       ',
            '   /ssssssssssshdmmNNmmyNMMMMhssssss/      ', '  +ssssssssshmydMMMMMMMNddddyssssssss+     ', ' /sssssssshNMMMyhhyyyyhmNMMMNhssssssss/    ', '.ssssssssdMMMNhsssssssssshNMMMdssssssss.   ',
            '+sssshhhyNMMNyssssssssssssyNMMMysssssss+   ', 'ossyNMMMNyMMhsssssssssssssshmmmhssssssso   ', 'ossyNMMMNyMMhsssssssssssssshmmmhssssssso   ', '+sssshhhyNMMNyssssssssssssyNMMMysssssss+   ',
            '.ssssssssdMMMNhsssssssssshNMMMdssssssss.   ', ' /sssssssshNMMMyhhyyyyhdNMMMNhssssssss/    ', '  +sssssssssdmydMMMMMMMMddddyssssssss+     ', '   /ssssssssssshdmNNNNmyNMMMMhssssss/      ',
            '    .ossssssssssssssssssdMMMNysssso.       ', '      -+sssssssssssssssssyyyssss+-         ', '        `:+ssssssssssssssssss+:`           ', '            .-/+oossssoo+/-.               '
        ];
        const info = [
            b(sh.user) + '@' + b(sh.system.hostname), '-'.repeat(sh.user.length + sh.system.hostname.length + 1),
            b('OS') + ': Ubuntu 24.04.1 LTS x86_64', b('Host') + ': Linux Arsenal Virtual Machine', b('Kernel') + ': ' + KERNEL, b('Uptime') + ': ' + uptimeText(sh.system).trim(),
            b('Packages') + ': ' + (1400 + Object.values(sh.system.packages).filter(Boolean).length) + ' (dpkg)', b('Shell') + ': bash 5.2.21', b('Terminal') + ': linux-arsenal-term',
            b('CPU') + ': Intel Xeon E5-2680 v4 (4) @ 2.400GHz', b('Memory') + ': 2195MiB / 7933MiB', '',
            ctx.tty ? '\x1b[40m   \x1b[41m   \x1b[42m   \x1b[43m   \x1b[44m   \x1b[45m   \x1b[46m   \x1b[47m   \x1b[0m' : ''
        ];
        for (let i = 0; i < logo.length; i++) ctx.outln(c(logo[i]) + (info[i] || ''));
        return 0;
    }, { pkg: 'neofetch' });
})();
