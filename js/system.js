// Linux Arsenal - simulated machine: base filesystem, users, processes, services, packages, network
(function () {
    'use strict';
    const LA = (globalThis.LA = globalThis.LA || {});
    const VFS = LA.VFS;
    const U = LA.util;

    const HOSTNAME = 'linux-arsenal';

    // ---------------------------------------------------------------- package catalog
    const PACKAGES = {
        'coreutils': { v: '9.4-3ubuntu6', d: 'GNU core utilities', installed: true, size: 7136 },
        'bash': { v: '5.2.21-2ubuntu4', d: 'GNU Bourne Again SHell', installed: true, size: 1864 },
        'grep': { v: '3.11-4build1', d: 'GNU grep, egrep and fgrep', installed: true, size: 1076 },
        'sed': { v: '4.9-2build1', d: 'GNU stream editor for filtering/transforming text', installed: true, size: 860 },
        'gawk': { v: '1:5.2.1-2build3', d: 'GNU awk, a pattern scanning and processing language', installed: true, size: 2450 },
        'findutils': { v: '4.9.0-5build1', d: 'utilities for finding files--find, xargs', installed: true, size: 1776 },
        'tar': { v: '1.35+dfsg-3build1', d: 'GNU version of the tar archiving utility', installed: true, size: 3092 },
        'gzip': { v: '1.12-1ubuntu3', d: 'GNU compression utilities', installed: true, size: 256 },
        'zip': { v: '3.0-13build1', d: 'Archiver for .zip files', installed: true, size: 632 },
        'unzip': { v: '6.0-28ubuntu4', d: 'De-archiver for .zip files', installed: true, size: 540 },
        'tree': { v: '2.1.1-2ubuntu3', d: 'displays an indented directory tree, in color', installed: true, size: 112, cmds: ['tree'] },
        'curl': { v: '8.5.0-2ubuntu10', d: 'command line tool for transferring data with URL syntax', installed: true, size: 532, cmds: ['curl'] },
        'wget': { v: '1.21.4-1ubuntu4', d: 'retrieves files from the web', installed: true, size: 956, cmds: ['wget'] },
        'git': { v: '1:2.43.0-1ubuntu7', d: 'fast, scalable, distributed revision control system', installed: true, size: 20780, cmds: ['git'] },
        'vim': { v: '2:9.1.0016-1ubuntu7', d: 'Vi IMproved - enhanced vi editor', installed: true, size: 4012, cmds: ['vim', 'vi', 'vimdiff'] },
        'nano': { v: '7.2-2build1', d: 'small, friendly text editor inspired by Pico', installed: true, size: 880, cmds: ['nano'] },
        'nginx': { v: '1.24.0-2ubuntu7', d: 'small, powerful, scalable web/proxy server', installed: true, size: 1336, cmds: ['nginx'] },
        'apache2': { v: '2.4.58-1ubuntu8', d: 'Apache HTTP Server', installed: true, size: 456, cmds: ['apache2ctl'] },
        'mysql-server': { v: '8.0.39-0ubuntu0.24.04.2', d: 'MySQL database server (metapackage depending on the latest version)', installed: true, size: 200 },
        'openssh-server': { v: '1:9.6p1-3ubuntu13', d: 'secure shell (SSH) server, for secure access from remote machines', installed: true, size: 1964 },
        'openssh-client': { v: '1:9.6p1-3ubuntu13', d: 'secure shell (SSH) client, for secure access to remote machines', installed: true, size: 5120, cmds: ['ssh', 'scp'] },
        'net-tools': { v: '2.10-0.1ubuntu4', d: 'NET-3 networking toolkit', installed: true, size: 812, cmds: ['ifconfig', 'netstat', 'route', 'arp'] },
        'iproute2': { v: '6.1.0-1ubuntu6', d: 'networking and traffic control tools', installed: true, size: 3496, cmds: ['ip', 'ss'] },
        'iputils-ping': { v: '3:20240117-1build1', d: 'Tools to test the reachability of network hosts', installed: true, size: 116, cmds: ['ping'] },
        'dnsutils': { v: '1:9.18.28-0ubuntu0.24.04.1', d: 'Transitional package for bind9-dnsutils', installed: true, size: 40, cmds: ['dig', 'nslookup', 'host'] },
        'traceroute': { v: '1:2.1.5-1', d: 'Traces the route taken by packets over an IPv4/IPv6 network', installed: true, size: 200, cmds: ['traceroute'] },
        'ufw': { v: '0.36.2-6', d: 'program for managing a Netfilter firewall', installed: true, size: 864, cmds: ['ufw'] },
        'iptables': { v: '1.8.10-3ubuntu2', d: 'administration tools for packet filtering and NAT', installed: true, size: 2780, cmds: ['iptables'] },
        'docker.io': { v: '24.0.7-0ubuntu4', d: 'Linux container runtime', installed: true, size: 108000, cmds: ['docker'] },
        'python3': { v: '3.12.3-0ubuntu2', d: 'interactive high-level object-oriented language (default python3 version)', installed: true, size: 92, cmds: ['python3', 'python'] },
        'procps': { v: '2:4.0.4-4ubuntu3', d: '/proc file system utilities', installed: true, size: 2352, cmds: ['ps', 'top', 'free', 'kill', 'pkill', 'pgrep', 'uptime', 'w', 'watch'] },
        'cron': { v: '3.0pl1-184ubuntu2', d: 'process scheduling daemon', installed: true, size: 284, cmds: ['crontab'] },
        'bc': { v: '1.07.1-3ubuntu4', d: 'GNU bc arbitrary precision calculator language', installed: true, size: 200, cmds: ['bc'] },
        'man-db': { v: '2.12.0-4build2', d: 'tools for reading manual pages', installed: true, size: 2780, cmds: ['man', 'whatis', 'apropos'] },
        'htop': { v: '3.3.0-4build1', d: 'interactive processes viewer', installed: false, size: 434, cmds: ['htop'] },
        'cowsay': { v: '3.03+dfsg2-8', d: 'configurable talking cow', installed: false, size: 92, cmds: ['cowsay', 'cowthink'] },
        'sl': { v: '5.02-1', d: 'Correct you if you type `sl\' by mistake', installed: false, size: 68, cmds: ['sl'] },
        'figlet': { v: '2.2.5-3', d: 'Make large character ASCII banners out of ordinary text', installed: false, size: 712, cmds: ['figlet'] },
        'fortune-mod': { v: '1:1.99.1-7.3build1', d: 'provides fortune cookies on demand', installed: false, size: 96, cmds: ['fortune'] },
        'neofetch': { v: '7.1.0-4', d: 'Shows Linux System Information with Distribution Logo', installed: false, size: 364, cmds: ['neofetch'] },
        'jq': { v: '1.7.1-3build1', d: 'lightweight and flexible command-line JSON processor', installed: false, size: 102, cmds: ['jq'] },
        'nmap': { v: '7.94+git20230807.3be01efb1+dfsg-3build2', d: 'The Network Mapper', installed: false, size: 4636, cmds: ['nmap'] },
        'ripgrep': { v: '14.1.0-1', d: 'Recursively searches directories for a regex pattern', installed: false, size: 5444, cmds: ['rg'] },
        'cmatrix': { v: '2.0-6', d: 'simulates the display from "The Matrix"', installed: false, size: 60, cmds: ['cmatrix'] },
        'tmux': { v: '3.4-1build1', d: 'terminal multiplexer', installed: false, size: 1136, cmds: [] },
        'postgresql': { v: '16+257build1', d: 'object-relational SQL database (supported version)', installed: false, size: 80, cmds: [] },
        'redis-server': { v: '5:7.0.15-1build2', d: 'Persistent key-value database with network interface', installed: false, size: 200, cmds: [] },
        'nodejs': { v: '18.19.1+dfsg-6ubuntu5', d: 'evented I/O for V8 javascript - runtime executable', installed: false, size: 860, cmds: [] },
        'golang': { v: '2:1.22~2build1', d: 'Go programming language compiler - metapackage', installed: false, size: 12, cmds: [] },
        'build-essential': { v: '12.10ubuntu1', d: 'Informational list of build-essential packages', installed: false, size: 20, cmds: [] },
        'lolcat': { v: '100.0.1-3', d: 'colorful `cat\'', installed: false, size: 40, cmds: [] },
        'tldr': { v: '0.9.2-1', d: 'simplified and community-driven man pages', installed: true, size: 60, cmds: ['tldr'] }
    };
    const PKG_OF_CMD = {};
    for (const [p, info] of Object.entries(PACKAGES)) for (const c of info.cmds || []) PKG_OF_CMD[c] = p;
    LA.PACKAGES = PACKAGES;
    LA.PKG_OF_CMD = PKG_OF_CMD;

    // ---------------------------------------------------------------- network
    const HOSTS = {
        'localhost': '127.0.0.1', 'linux-arsenal': '127.0.1.1', 'google.com': '142.250.190.78', 'www.google.com': '142.250.190.100',
        'github.com': '140.82.112.3', 'api.github.com': '140.82.112.6', 'example.com': '93.184.216.34', 'www.example.com': '93.184.216.34',
        'cloudflare.com': '104.16.132.229', 'one.one.one.one': '1.1.1.1', 'dns.google': '8.8.8.8', 'wikipedia.org': '208.80.154.224',
        'kernel.org': '139.178.84.217', 'archlinux.org': '95.217.163.246', 'ubuntu.com': '185.125.190.20', 'debian.org': '151.101.2.132',
        'httpbin.org': '54.208.105.16', 'linux-arsenal.dev': '203.0.113.10', 'db.internal': '10.0.0.20', 'web01.internal': '10.0.0.11',
        'web02.internal': '10.0.0.12', 'backup.internal': '10.0.0.30', 'stackoverflow.com': '198.252.206.16', 'openai.com': '104.18.33.45',
        'archive.ubuntu.com': '91.189.91.82', 'security.ubuntu.com': '185.125.190.39', 'mirror.local': '192.168.1.10', 'router.local': '192.168.1.1'
    };
    const UNREACHABLE = new Set(['10.0.0.99', 'dead.internal']);
    HOSTS['dead.internal'] = '10.0.0.99';
    const WEB = {
        'example.com/': { type: 'text/html', body: '<!doctype html>\n<html>\n<head>\n    <title>Example Domain</title>\n</head>\n<body>\n<div>\n    <h1>Example Domain</h1>\n    <p>This domain is for use in illustrative examples in documents.</p>\n    <p><a href="https://www.iana.org/domains/example">More information...</a></p>\n</div>\n</body>\n</html>\n' },
        'httpbin.org/get': { type: 'application/json', body: '{\n  "args": {},\n  "headers": {\n    "Accept": "*/*",\n    "Host": "httpbin.org",\n    "User-Agent": "curl/8.5.0"\n  },\n  "origin": "198.51.100.23",\n  "url": "https://httpbin.org/get"\n}\n' },
        'httpbin.org/ip': { type: 'application/json', body: '{\n  "origin": "198.51.100.23"\n}\n' },
        'httpbin.org/user-agent': { type: 'application/json', body: '{\n  "user-agent": "curl/8.5.0"\n}\n' },
        'httpbin.org/uuid': { type: 'application/json', body: '{\n  "uuid": "6f1d7c36-90a2-4c55-8b1e-6a3f1d2b9c41"\n}\n' },
        'api.github.com/users/octocat': { type: 'application/json', body: '{\n  "login": "octocat",\n  "id": 583231,\n  "name": "The Octocat",\n  "company": "@github",\n  "location": "San Francisco",\n  "public_repos": 8,\n  "followers": 9999\n}\n' },
        'api.github.com/': { type: 'application/json', body: '{\n  "current_user_url": "https://api.github.com/user",\n  "repository_url": "https://api.github.com/repos/{owner}/{repo}"\n}\n' },
        'linux-arsenal.dev/': { type: 'text/html', body: '<!doctype html>\n<html><head><title>Linux Arsenal</title></head>\n<body><h1>Welcome to Linux Arsenal</h1><p>Master the command line.</p></body></html>\n' },
        'linux-arsenal.dev/install.sh': { type: 'text/x-sh', body: '#!/bin/bash\necho "Installing Linux Arsenal toolkit..."\necho "Done!"\n' },
        'linux-arsenal.dev/data.csv': { type: 'text/csv', body: 'id,name,score\n1,alice,92\n2,bob,85\n3,carol,78\n4,dave,95\n' },
        'linux-arsenal.dev/motd.txt': { type: 'text/plain', body: 'Keep calm and grep on.\n' },
        'linux-arsenal.dev/api/status': { type: 'application/json', body: '{"status":"ok","version":"2.0.0","uptime":86400}\n' },
        'google.com/': { type: 'text/html', body: '<!doctype html><html itemscope="" itemtype="http://schema.org/WebPage" lang="en"><head><title>Google</title></head><body>Search the world\'s information</body></html>\n' },
        'github.com/': { type: 'text/html', body: '<!DOCTYPE html>\n<html lang="en"><head><title>GitHub: Let\'s build from here</title></head><body></body></html>\n' }
    };
    LA.NET = { HOSTS, WEB, UNREACHABLE };

    // ---------------------------------------------------------------- system state
    function createSystemState() {
        const boot = Date.now() - (3 * 86400 + 4 * 3600 + 17 * 60) * 1000;
        const sys = {
            hostname: HOSTNAME,
            bootTime: boot,
            users: [
                { name: 'root', uid: 0, gid: 0, home: '/root', shell: '/bin/bash', gecos: 'root' },
                { name: 'daemon', uid: 1, gid: 1, home: '/usr/sbin', shell: '/usr/sbin/nologin', gecos: 'daemon' },
                { name: 'bin', uid: 2, gid: 2, home: '/bin', shell: '/usr/sbin/nologin', gecos: 'bin' },
                { name: 'sys', uid: 3, gid: 3, home: '/dev', shell: '/usr/sbin/nologin', gecos: 'sys' },
                { name: 'www-data', uid: 33, gid: 33, home: '/var/www', shell: '/usr/sbin/nologin', gecos: 'www-data' },
                { name: 'nobody', uid: 65534, gid: 65534, home: '/nonexistent', shell: '/usr/sbin/nologin', gecos: 'nobody' },
                { name: 'syslog', uid: 104, gid: 111, home: '/home/syslog', shell: '/usr/sbin/nologin', gecos: '' },
                { name: 'mysql', uid: 110, gid: 117, home: '/nonexistent', shell: '/bin/false', gecos: 'MySQL Server,,,' },
                { name: 'sshd', uid: 111, gid: 65534, home: '/run/sshd', shell: '/usr/sbin/nologin', gecos: '' },
                { name: 'user', uid: 1000, gid: 1000, home: '/home/user', shell: '/bin/bash', gecos: 'Linux Arsenal User,,,' },
                { name: 'alice', uid: 1001, gid: 1001, home: '/home/alice', shell: '/bin/bash', gecos: 'Alice Admin,,,' },
                { name: 'bob', uid: 1002, gid: 1002, home: '/home/bob', shell: '/bin/bash', gecos: 'Bob Builder,,,' }
            ],
            groups: [
                { name: 'root', gid: 0, members: [] }, { name: 'daemon', gid: 1, members: [] }, { name: 'bin', gid: 2, members: [] },
                { name: 'sys', gid: 3, members: [] }, { name: 'adm', gid: 4, members: ['syslog', 'user'] }, { name: 'tty', gid: 5, members: [] },
                { name: 'sudo', gid: 27, members: ['user', 'alice'] }, { name: 'www-data', gid: 33, members: [] }, { name: 'shadow', gid: 42, members: [] },
                { name: 'users', gid: 100, members: ['user'] }, { name: 'syslog', gid: 111, members: [] }, { name: 'mysql', gid: 117, members: [] },
                { name: 'docker', gid: 998, members: ['user'] }, { name: 'developers', gid: 1500, members: ['alice', 'bob'] },
                { name: 'user', gid: 1000, members: [] }, { name: 'alice', gid: 1001, members: [] }, { name: 'bob', gid: 1002, members: [] },
                { name: 'nogroup', gid: 65534, members: [] }
            ],
            passwords: { user: 'arsenal', alice: 'wonderland', bob: 'builder', root: 'toor' },
            services: {
                nginx: { desc: 'A high performance web server and a reverse proxy server', active: true, enabled: true, pidBase: 640, procs: [['root', 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;'], ['www-data', 'nginx: worker process'], ['www-data', 'nginx: worker process']], port: [80, 443] },
                ssh: { desc: 'OpenBSD Secure Shell server', active: true, enabled: true, pidBase: 512, procs: [['root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups']], port: [22] },
                cron: { desc: 'Regular background program processing daemon', active: true, enabled: true, pidBase: 401, procs: [['root', '/usr/sbin/cron -f -P']] },
                rsyslog: { desc: 'System Logging Service', active: true, enabled: true, pidBase: 455, procs: [['syslog', '/usr/sbin/rsyslogd -n -iNONE']] },
                docker: { desc: 'Docker Application Container Engine', active: true, enabled: true, pidBase: 880, procs: [['root', '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock']] },
                ufw: { desc: 'Uncomplicated firewall', active: true, enabled: true, pidBase: 0, procs: [] },
                apache2: { desc: 'The Apache HTTP Server', active: false, enabled: false, pidBase: 1210, procs: [['root', '/usr/sbin/apache2 -k start'], ['www-data', '/usr/sbin/apache2 -k start']], port: [8080] },
                mysql: { desc: 'MySQL Community Server', active: false, enabled: false, pidBase: 1302, procs: [['mysql', '/usr/sbin/mysqld']], port: [3306] },
                'systemd-journald': { desc: 'Journal Service', active: true, enabled: true, pidBase: 312, procs: [['root', '/lib/systemd/systemd-journald']] },
                'systemd-networkd': { desc: 'Network Configuration', active: true, enabled: true, pidBase: 350, procs: [['systemd-network', '/lib/systemd/systemd-networkd']] },
                'systemd-resolved': { desc: 'Network Name Resolution', active: true, enabled: true, pidBase: 362, procs: [['systemd-resolve', '/lib/systemd/systemd-resolved']], port: [53] }
            },
            processes: [],
            packages: {},
            firewall: { enabled: true, rules: ['22/tcp ALLOW IN Anywhere', '80/tcp ALLOW IN Anywhere', '443/tcp ALLOW IN Anywhere'] },
            crontabs: { root: '', user: '# m h  dom mon dow   command\n0 2 * * * /home/user/scripts/backup.sh\n' },
            journal: [],
            docker: null,
            mounts: [],
            nextPid: 2400,
            logins: []
        };
        for (const [k, v] of Object.entries(PACKAGES)) sys.packages[k] = v.installed;

        // base processes
        const base = [
            [1, 0, 'root', '/sbin/init splash', 'Ss', 0.0, 0.1, 167744, 13048],
            [2, 0, 'root', '[kthreadd]', 'S', 0.0, 0.0, 0, 0],
            [3, 2, 'root', '[rcu_gp]', 'I<', 0.0, 0.0, 0, 0],
            [14, 2, 'root', '[ksoftirqd/0]', 'S', 0.0, 0.0, 0, 0],
            [15, 2, 'root', '[rcu_sched]', 'I', 0.0, 0.0, 0, 0],
            [88, 2, 'root', '[kworker/0:1H-kblockd]', 'I<', 0.0, 0.0, 0, 0],
            [702, 1, 'root', '/usr/lib/accountsservice/accounts-daemon', 'Ssl', 0.0, 0.1, 234480, 7980],
            [715, 1, 'messagebus', '@dbus-daemon --system --address=systemd: --nofork --nopidfile', 'Ss', 0.0, 0.0, 9240, 5120],
            [740, 1, 'root', '/usr/sbin/irqbalance --foreground', 'Ssl', 0.0, 0.0, 82708, 3940],
            [1001, 512, 'user', 'sshd: user@pts/0', 'S', 0.0, 0.1, 17340, 6640],
            [1002, 1001, 'user', '-bash', 'Ss', 0.0, 0.0, 10248, 5280]
        ];
        for (const b of base) sys.processes.push({ pid: b[0], ppid: b[1], user: b[2], cmd: b[3], stat: b[4], cpu: b[5], mem: b[6], vsz: b[7], rss: b[8], tty: b[2] === 'user' ? 'pts/0' : '?', start: boot });
        for (const [name, svc] of Object.entries(sys.services)) if (svc.active) startServiceProcs(sys, name);
        // a CPU hog the learner can find and kill
        sys.processes.push({ pid: 2187, ppid: 1, user: 'user', cmd: 'python3 /home/user/scripts/miner.py --threads 4', stat: 'R', cpu: 87.5, mem: 3.2, vsz: 412332, rss: 262144, tty: '?', start: Date.now() - 3600 * 1000 });
        sys.processes.push({ pid: 2190, ppid: 1, user: 'user', cmd: 'node /home/user/projects/website/server.js', stat: 'Sl', cpu: 1.2, mem: 1.9, vsz: 1043308, rss: 156672, tty: '?', start: Date.now() - 7200 * 1000 });

        Object.assign(sys, systemMethods);
        return sys;
    }

    function startServiceProcs(sys, name) {
        const svc = sys.services[name];
        if (!svc || !svc.procs.length) return;
        svc.procs.forEach((p, i) => {
            const pid = svc.pidBase + i;
            if (sys.processes.some((x) => x.pid === pid)) return;
            sys.processes.push({ pid, ppid: i === 0 ? 1 : svc.pidBase, user: p[0], cmd: p[1], stat: i === 0 ? 'Ss' : 'S', cpu: name === 'mysql' ? 0.8 : 0.0, mem: name === 'mysql' ? 9.8 : 0.1, vsz: 55000 + i * 1000, rss: 5000 + i * 300, tty: '?', start: Date.now(), service: name });
        });
    }

    const systemMethods = {
        userExists(n) { return this.users.some((u) => u.name === n); },
        groupExists(n) { return this.groups.some((g) => g.name === n); },
        getUser(n) { return this.users.find((u) => u.name === n); },
        uidOf(n) { const u = this.getUser(n); return u ? u.uid : 0; },
        gidOf(g) { const x = this.groups.find((y) => y.name === g); return x ? x.gid : 0; },
        homeOf(n) { const u = this.getUser(n); return u ? u.home : null; },
        primaryGroupOf(n) { const u = this.getUser(n); if (!u) return n; const g = this.groups.find((x) => x.gid === u.gid); return g ? g.name : n; },
        groupsOf(n) {
            const u = this.getUser(n);
            const out = [];
            if (u) { const pg = this.groups.find((g) => g.gid === u.gid); if (pg) out.push(pg.name); }
            for (const g of this.groups) if (g.members.includes(n) && !out.includes(g.name)) out.push(g.name);
            if (!out.length) out.push(n);
            return out;
        },
        isAlive(pid) {
            this.reap();
            return this.processes.some((p) => p.pid === pid);
        },
        reap() {
            const now = Date.now();
            this.processes = this.processes.filter((p) => !(p.until && p.until < now));
        },
        addProcess(p) {
            const proc = Object.assign({ ppid: 1002, stat: 'S', cpu: 0.0, mem: 0.0, vsz: 8272, rss: 1920, tty: 'pts/0', start: Date.now(), job: true }, p);
            if (!proc.pid) proc.pid = ++this.nextPid;
            this.processes.push(proc);
            return proc.pid;
        },
        signalProcess(pid, signal, asUser) {
            this.reap();
            const p = this.processes.find((x) => x.pid === pid);
            if (!p) return 'ESRCH';
            if (asUser !== 'root' && p.user !== asUser) return 'EPERM';
            const sig = String(signal).toUpperCase().replace(/^SIG/, '');
            if (['0'].includes(sig)) return 'OK';
            if (['STOP', '19', 'TSTP', '20'].includes(sig)) { p.stat = 'T'; return 'OK'; }
            if (['CONT', '18'].includes(sig)) { p.stat = 'S'; return 'OK'; }
            if (['HUP', '1'].includes(sig) && p.service) return 'OK';
            if (pid === 1) return asUser === 'root' ? 'OK' : 'EPERM';
            this.killProcess(pid);
            return 'OK';
        },
        killProcess(pid) {
            const p = this.processes.find((x) => x.pid === pid);
            this.processes = this.processes.filter((x) => x.pid !== pid && x.ppid !== pid);
            if (p && p.service) {
                const svc = this.services[p.service];
                if (svc && svc.pidBase === pid) { svc.active = false; svc.failed = true; this.processes = this.processes.filter((x) => x.service !== p.service); }
            }
            if (p && p.container && this.docker) {
                const c = this.docker.containers.find((x) => x.id === p.container);
                if (c) c.status = 'exited';
            }
        },
        startService(name) {
            const svc = this.services[name];
            svc.active = true; svc.failed = false; svc.since = Date.now();
            startServiceProcs(this, name);
            this.log(name, 'Started ' + svc.desc + '.');
        },
        stopService(name) {
            const svc = this.services[name];
            svc.active = false; svc.since = Date.now();
            this.processes = this.processes.filter((p) => p.service !== name);
            this.log(name, 'Stopped ' + svc.desc + '.');
        },
        log(unit, msg) {
            this.journal.push({ t: Date.now(), unit, msg });
        },
        uptimeSeconds() { return Math.floor((Date.now() - this.bootTime) / 1000); },
        // keep /etc/passwd, /etc/group, /etc/shadow in sync
        syncFiles(fs) {
            const passwd = this.users.map((u) => [u.name, 'x', u.uid, u.gid, u.gecos, u.home, u.shell].join(':')).join('\n') + '\n';
            const group = this.groups.map((g) => [g.name, 'x', g.gid, g.members.join(',')].join(':')).join('\n') + '\n';
            const shadow = this.users.map((u) => [u.name, this.passwords[u.name] ? '$y$j9T$' + U.hashString(this.passwords[u.name] + u.name).toString(36) + 'Qx7.Lf/' : (u.uid >= 1000 ? '!' : '*'), 19800, 0, 99999, 7, '', '', ''].join(':')).join('\n') + '\n';
            const write = (p, c, mode, groupName) => {
                const saved = fs.user;
                fs.user = { name: 'root', groups: ['root'] };
                try {
                    const n = fs.writeFile(p, c, { owner: 'root' });
                    n.mode = mode; n.owner = 'root'; n.group = groupName || 'root';
                } finally { fs.user = saved; }
            };
            write('/etc/passwd', passwd, 0o644);
            write('/etc/group', group, 0o644);
            write('/etc/shadow', shadow, 0o640, 'shadow');
        }
    };

    // ---------------------------------------------------------------- base filesystem
    function seededLines(seed, n, fn) {
        const rnd = U.mulberry32(seed);
        const out = [];
        for (let i = 0; i < n; i++) out.push(fn(rnd, i));
        return out;
    }
    const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

    function accessLog() {
        const ips = ['192.168.1.10', '192.168.1.15', '10.0.0.5', '203.0.113.7', '198.51.100.23', '192.168.1.10', '172.16.0.4', '203.0.113.7', '192.168.1.10'];
        const paths = ['/', '/index.html', '/about', '/login', '/api/users', '/images/logo.png', '/admin', '/wp-login.php', '/css/style.css', '/api/orders'];
        const codes = [200, 200, 200, 200, 304, 404, 200, 500, 301, 403];
        const agents = ['Mozilla/5.0 (X11; Linux x86_64)', 'curl/8.5.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Googlebot/2.1'];
        return seededLines(42, 60, (r, i) => {
            const ip = pick(r, ips);
            const m = pick(r, ['GET', 'GET', 'GET', 'POST']);
            const path = pick(r, paths);
            const code = pick(r, codes);
            const size = code === 304 ? 0 : 200 + Math.floor(r() * 5000);
            const mm = String(10 + Math.floor(i / 6)).padStart(2, '0');
            const ss = String((i * 7) % 60).padStart(2, '0');
            return ip + ' - - [04/Nov/2026:09:' + mm + ':' + ss + ' +0000] "' + m + ' ' + path + ' HTTP/1.1" ' + code + ' ' + size + ' "-" "' + pick(r, agents) + '"';
        }).join('\n') + '\n';
    }
    function authLog() {
        const lines = [];
        const rnd = U.mulberry32(7);
        const ips = ['203.0.113.7', '198.51.100.23', '192.0.2.44', '203.0.113.7', '45.33.32.156'];
        const users = ['root', 'admin', 'test', 'oracle', 'root', 'ubuntu'];
        for (let i = 0; i < 40; i++) {
            const t = 'Nov  4 0' + (Math.floor(i / 10) + 6) + ':' + String((i * 3) % 60).padStart(2, '0') + ':' + String((i * 11) % 60).padStart(2, '0');
            const r = rnd();
            if (r < 0.55) {
                const u = pick(rnd, users);
                lines.push(t + ' linux-arsenal sshd[' + (3000 + i) + ']: Failed password for ' + (u === 'root' ? '' : 'invalid user ') + u + ' from ' + pick(rnd, ips) + ' port ' + (40000 + Math.floor(rnd() * 20000)) + ' ssh2');
            } else if (r < 0.75) {
                lines.push(t + ' linux-arsenal sshd[' + (3000 + i) + ']: Accepted publickey for user from 192.168.1.15 port ' + (50000 + i) + ' ssh2: RSA SHA256:x4Fq9k2');
            } else if (r < 0.9) {
                lines.push(t + ' linux-arsenal sudo:     user : TTY=pts/0 ; PWD=/home/user ; USER=root ; COMMAND=/usr/bin/apt update');
            } else {
                lines.push(t + ' linux-arsenal CRON[' + (4000 + i) + ']: pam_unix(cron:session): session opened for user root(uid=0) by (uid=0)');
            }
        }
        return lines.join('\n') + '\n';
    }
    function syslog() {
        const msgs = [
            'systemd[1]: Started Daily apt download activities.',
            'kernel: [    0.000000] Linux version 6.8.0-45-generic (buildd@lcy02-amd64-115) (x86_64-linux-gnu-gcc-13) #45-Ubuntu SMP PREEMPT_DYNAMIC',
            'CRON[2211]: (root) CMD (cd / && run-parts --report /etc/cron.hourly)',
            'nginx[640]: 2026/11/04 09:12:44 [error] 641#641: *12 open() "/var/www/html/favicon.ico" failed (2: No such file or directory)',
            'systemd[1]: Starting Cleanup of Temporary Directories...',
            'kernel: [ 1234.567890] EXT4-fs (sda1): re-mounted. Opts: errors=remount-ro',
            'systemd-resolved[362]: Clock change detected. Flushing caches.',
            'kernel: [ 2001.004512] Out of memory: Killed process 1987 (java) total-vm:4123456kB',
            'systemd[1]: mysql.service: Main process exited, code=exited, status=1/FAILURE',
            'sshd[512]: Server listening on 0.0.0.0 port 22.',
            'dockerd[880]: time="2026-11-04T09:00:01Z" level=warning msg="failed to prune image cache"',
            'kernel: [ 3005.112233] usb 1-1: new high-speed USB device number 3 using xhci_hcd',
            'systemd[1]: backup.service: Failed with result \'exit-code\'.',
            'CRON[2290]: (user) CMD (/home/user/scripts/backup.sh)',
            'rsyslogd: [origin software="rsyslogd"] rsyslogd was HUPed'
        ];
        return seededLines(99, 45, (r, i) => 'Nov  4 ' + String(6 + Math.floor(i / 8)).padStart(2, '0') + ':' + String((i * 13) % 60).padStart(2, '0') + ':' + String((i * 29) % 60).padStart(2, '0') + ' linux-arsenal ' + msgs[(i * 7 + Math.floor(r() * 3)) % msgs.length]).join('\n') + '\n';
    }

    const FILES_PRACTICE = {
        'documents/readme.txt': 'Welcome to Linux Arsenal!\nThis is your home directory inside a fully simulated Linux machine.\nNothing you do here can harm your real computer.\nTry: ls, cd, cat, grep, find, man, and tutorial.\nType `help` to see everything you can do.\n',
        'documents/notes.txt': 'Meeting notes - Monday\n- Review server logs\n- Update nginx configuration\n- Rotate SSH keys\n- Backup database\nTODO: ask alice about the deploy script\nTODO: clean up /tmp\n',
        'documents/todo.txt': '1. Learn ls and cd\n2. Learn grep\n3. Learn pipes\n4. Learn permissions\n5. Write a bash script\n6. Master awk and sed\n',
        'documents/poem.txt': 'The quick brown fox\njumps over the lazy dog.\nThe dog sleeps,\nthe fox runs,\nand the terminal blinks on.\n',
        'documents/report.md': '# Quarterly Report\n\n## Summary\nRevenue grew 12% this quarter.\n\n## Issues\n- Server downtime on Oct 3\n- Disk usage above 80%\n',
        'projects/website/index.html': '<!DOCTYPE html>\n<html>\n<head>\n  <title>My Site</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello from Linux Arsenal</h1>\n  <script src="app.js"></script>\n</body>\n</html>\n',
        'projects/website/style.css': 'body {\n  font-family: monospace;\n  background: #0a0a0a;\n  color: #00ff41;\n}\n',
        'projects/website/app.js': "console.log('Hello, world!');\n// TODO: add a dark mode toggle\n",
        'projects/website/server.js': "const http = require('http');\nhttp.createServer((req, res) => res.end('ok')).listen(3000);\n",
        'projects/python/hello.py': '#!/usr/bin/env python3\nprint("Hello, Linux Arsenal!")\n',
        'projects/python/requirements.txt': 'flask==3.0.0\nrequests==2.31.0\nnumpy==1.26.2\n',
        'scripts/backup.sh': '#!/bin/bash\n# Simple backup script\nSRC="$HOME/documents"\nDEST="/tmp/backup-$(date +%F).tar.gz"\ntar -czf "$DEST" -C "$HOME" documents\necho "Backup written to $DEST"\n',
        'scripts/hello.sh': '#!/bin/bash\nname=${1:-World}\necho "Hello, $name!"\n',
        'scripts/count.sh': '#!/bin/bash\nfor i in $(seq 1 5); do\n  echo "Count: $i"\ndone\n',
        'scripts/miner.py': '# suspicious script that uses lots of CPU\nwhile True:\n    pass\n',
        'data/employees.csv': 'id,name,department,salary,city\n1,Alice,Engineering,95000,Berlin\n2,Bob,Marketing,62000,London\n3,Carol,Engineering,105000,Berlin\n4,Dave,Sales,58000,Paris\n5,Eve,Engineering,99000,London\n6,Frank,Sales,61000,Berlin\n7,Grace,Marketing,70000,Paris\n8,Heidi,Support,48000,London\n',
        'data/numbers.txt': '42\n7\n19\n3\n88\n15\n7\n61\n23\n42\n',
        'data/fruits.txt': 'apple\nbanana\ncherry\napple\ndate\nbanana\nelderberry\nfig\napple\ngrape\n',
        'data/words.txt': 'linux\nbash\nkernel\nshell\nterminal\npipe\nprocess\nsignal\ndaemon\nfilesystem\n',
        'data/server.log': '2026-11-04 08:00:01 INFO Server started on port 8080\n2026-11-04 08:05:12 INFO User alice logged in\n2026-11-04 08:07:45 WARN Disk usage at 81%\n2026-11-04 08:10:03 ERROR Database connection timeout\n2026-11-04 08:10:09 INFO Retrying database connection\n2026-11-04 08:10:15 INFO Database connected\n2026-11-04 08:30:22 ERROR Failed to send email to bob@example.com\n2026-11-04 09:01:00 INFO Cron job backup.sh completed\n2026-11-04 09:15:42 WARN High memory usage: 91%\n2026-11-04 09:20:11 ERROR Out of memory: process 1987 killed\n2026-11-04 09:30:00 INFO User bob logged out\n',
        'data/config.ini': '[server]\nhost=0.0.0.0\nport=8080\ndebug=false\n\n[database]\nhost=db.internal\nport=5432\nuser=app\n',
        'data/users.json': '[\n  {"name": "alice", "role": "admin", "active": true},\n  {"name": "bob", "role": "developer", "active": true},\n  {"name": "carol", "role": "viewer", "active": false}\n]\n',
        'downloads/linux-cheatsheet.pdf': '%PDF-1.7\n%binary data...\n',
        'pictures/vacation.jpg': '\xff\xd8\xff\xe0 JFIF binary',
        'pictures/screenshot.png': '\x89PNG\r\n binary',
        '.hidden_notes': 'You found the hidden file! Files starting with a dot are hidden from plain `ls`.\nUse `ls -a` to see them.\n',
        '.secret/flag.txt': 'FLAG{h1dd3n_d1r3ct0r13s_4r3_fun}\n'
    };

    function buildFilesystem(opts) {
        opts = opts || {};
        const sys = opts.system;
        const fs = new VFS();
        fs.user = { name: 'root', groups: ['root'] };
        const dir = (p, mode, owner, group) => {
            const n = fs.get(p) || fs.mkdir(p, { parents: true });
            n.mode = mode !== undefined ? mode : 0o755;
            n.owner = owner || 'root';
            n.group = group || owner || 'root';
            return n;
        };
        const file = (p, content, mode, owner, group) => {
            if (!fs.isDir(VFS.dirname(p))) dir(VFS.dirname(p));
            const n = fs.writeFile(p, content);
            n.mode = mode !== undefined ? mode : 0o644;
            n.owner = owner || 'root';
            n.group = group || owner || 'root';
            n.mtime = Date.now() - 86400000 * 3;
            return n;
        };
        for (const d of ['/usr/bin', '/usr/sbin', '/usr/lib', '/usr/local/bin', '/usr/local/sbin', '/usr/local/lib', '/usr/share/doc', '/usr/share/man/man1', '/usr/include', '/usr/src',
            '/etc', '/etc/nginx/sites-available', '/etc/nginx/sites-enabled', '/etc/ssh', '/etc/apt', '/etc/cron.d', '/etc/cron.daily', '/etc/systemd/system', '/etc/default', '/etc/skel', '/etc/sudoers.d', '/etc/apache2', '/etc/mysql',
            '/var/log/nginx', '/var/log/apt', '/var/www/html', '/var/lib/apt', '/var/lib/dpkg', '/var/cache/apt', '/var/spool/cron/crontabs', '/var/mail', '/var/backups', '/var/lib/docker', '/var/lib/mysql',
            '/opt', '/srv', '/mnt', '/media', '/boot', '/run', '/sys', '/proc', '/dev', '/lib', '/lib64', '/snap']) dir(d);
        dir('/root', 0o700);
        dir('/tmp', 0o1777);
        dir('/var/tmp', 0o1777);
        dir('/var/lib/mysql', 0o700, 'mysql', 'mysql');
        // merged /usr layout
        fs.symlink('usr/bin', '/bin');
        fs.symlink('usr/sbin', '/sbin');
        // devices
        for (const d of ['null', 'zero', 'random', 'urandom', 'tty', 'stdin', 'stdout', 'stderr']) {
            const n = VFS.makeNode('dev', { device: d, mode: 0o666, owner: 'root', group: d === 'tty' ? 'tty' : 'root' });
            fs.get('/dev').children[d] = n;
        }
        dir('/dev/shm', 0o1777);
        // binaries
        const sbin = new Set(['useradd', 'userdel', 'usermod', 'groupadd', 'groupdel', 'adduser', 'deluser', 'iptables', 'ufw', 'shutdown', 'reboot', 'poweroff', 'halt', 'ifconfig', 'route', 'arp', 'nginx', 'apache2ctl', 'service', 'chpasswd', 'visudo', 'fdisk', 'mkfs', 'sysctl', 'modprobe', 'lsmod']);
        for (const name of Object.keys(LA.commands)) {
            const cmd = LA.commands[name];
            if (cmd.builtin && !['echo', 'printf', 'kill', 'pwd', 'test', '[', 'true', 'false', 'time'].includes(name)) continue;
            if (name === '.' || name === ':' || name === '[[' || cmd.virtual) continue;
            const pkg = PKG_OF_CMD[name] || cmd.pkg;
            if (pkg && PACKAGES[pkg] && sys && !sys.packages[pkg]) continue;
            if (cmd.pkg && !PACKAGES[cmd.pkg] ) continue;
            const where = sbin.has(name) ? '/usr/sbin/' : '/usr/bin/';
            file(where + name, '#!LA-BUILTIN ' + name + '\n', 0o755);
        }
        const sudoNode = fs.get('/usr/bin/sudo');
        if (sudoNode) sudoNode.mode = 0o4755;
        const passwdNode = fs.get('/usr/bin/passwd');
        if (passwdNode) passwdNode.mode = 0o4755;
        // /etc
        file('/etc/hostname', HOSTNAME + '\n');
        file('/etc/hosts', '127.0.0.1\tlocalhost\n127.0.1.1\t' + HOSTNAME + '\n10.0.0.11\tweb01.internal web01\n10.0.0.12\tweb02.internal web02\n10.0.0.20\tdb.internal db\n10.0.0.30\tbackup.internal\n\n# The following lines are desirable for IPv6 capable hosts\n::1     ip6-localhost ip6-loopback\nff02::1 ip6-allnodes\nff02::2 ip6-allrouters\n');
        file('/etc/os-release', 'PRETTY_NAME="Ubuntu 24.04.1 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nVERSION="24.04.1 LTS (Noble Numbat)"\nVERSION_CODENAME=noble\nID=ubuntu\nID_LIKE=debian\nHOME_URL="https://www.ubuntu.com/"\nSUPPORT_URL="https://help.ubuntu.com/"\nUBUNTU_CODENAME=noble\n');
        file('/etc/issue', 'Ubuntu 24.04.1 LTS \\n \\l\n\n');
        file('/etc/lsb-release', 'DISTRIB_ID=Ubuntu\nDISTRIB_RELEASE=24.04\nDISTRIB_CODENAME=noble\nDISTRIB_DESCRIPTION="Ubuntu 24.04.1 LTS"\n');
        file('/etc/motd', '\nWelcome to Linux Arsenal (GNU/Linux 6.8.0-45-generic x86_64)\n\n * Documentation:  type `help` or `man <command>`\n * Challenges:     type `challenge list`\n * Tutorial:       type `tutorial`\n\n');
        file('/etc/shells', '# /etc/shells: valid login shells\n/bin/sh\n/bin/bash\n/usr/bin/bash\n/bin/dash\n/usr/bin/zsh\n');
        file('/etc/timezone', 'Etc/UTC\n');
        file('/etc/resolv.conf', '# This is /run/systemd/resolve/stub-resolv.conf managed by man:systemd-resolved(8).\nnameserver 127.0.0.53\noptions edns0 trust-ad\nsearch internal\n');
        file('/etc/fstab', '# /etc/fstab: static file system information.\n# <file system> <mount point>   <type>  <options>       <dump>  <pass>\nUUID=3f1c2a9e-7b4d-4c1e-9f0a-1d2e3c4b5a69 /               ext4    errors=remount-ro 0       1\nUUID=AB12-CD34  /boot/efi       vfat    umask=0077      0       1\n/swapfile                                 none            swap    sw              0       0\n');
        file('/etc/profile', '# /etc/profile: system-wide .profile file for the Bourne shell\nif [ -d /etc/profile.d ]; then\n  for i in /etc/profile.d/*.sh; do\n    [ -r $i ] && . $i\n  done\nfi\n');
        file('/etc/bash.bashrc', '# System-wide .bashrc file for interactive bash(1) shells.\n[ -z "$PS1" ] && return\nshopt -s checkwinsize\n');
        file('/etc/environment', 'PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\n');
        file('/etc/crontab', '# /etc/crontab: system-wide crontab\nSHELL=/bin/sh\nPATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n\n# m h dom mon dow user\tcommand\n17 *\t* * *\troot\tcd / && run-parts --report /etc/cron.hourly\n25 6\t* * *\troot\ttest -x /usr/sbin/anacron || run-parts --report /etc/cron.daily\n47 6\t* * 7\troot\ttest -x /usr/sbin/anacron || run-parts --report /etc/cron.weekly\n');
        file('/etc/sudoers', 'Defaults\tenv_reset\nDefaults\tsecure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\n\nroot\tALL=(ALL:ALL) ALL\n%sudo\tALL=(ALL:ALL) ALL\n\n@includedir /etc/sudoers.d\n', 0o440);
        file('/etc/ssh/sshd_config', '# OpenSSH server configuration\nPort 22\n#AddressFamily any\nListenAddress 0.0.0.0\nPermitRootLogin yes\nPasswordAuthentication yes\nPubkeyAuthentication yes\nMaxAuthTries 6\nX11Forwarding yes\nPrintMotd no\nAcceptEnv LANG LC_*\nSubsystem sftp /usr/lib/openssh/sftp-server\n');
        file('/etc/ssh/ssh_config', 'Host *\n    SendEnv LANG LC_*\n    HashKnownHosts yes\n');
        file('/etc/nginx/nginx.conf', 'user www-data;\nworker_processes auto;\npid /run/nginx.pid;\n\nevents {\n    worker_connections 768;\n}\n\nhttp {\n    sendfile on;\n    tcp_nopush on;\n    keepalive_timeout 65;\n    include /etc/nginx/mime.types;\n    default_type application/octet-stream;\n    access_log /var/log/nginx/access.log;\n    error_log /var/log/nginx/error.log;\n    gzip on;\n    include /etc/nginx/sites-enabled/*;\n}\n');
        file('/etc/nginx/sites-available/default', 'server {\n    listen 80 default_server;\n    listen [::]:80 default_server;\n    root /var/www/html;\n    index index.html index.htm;\n    server_name _;\n    location / {\n        try_files $uri $uri/ =404;\n    }\n}\n');
        fs.symlink('/etc/nginx/sites-available/default', '/etc/nginx/sites-enabled/default');
        file('/etc/apache2/apache2.conf', 'ServerRoot "/etc/apache2"\nListen 8080\nUser www-data\nGroup www-data\nErrorLog ${APACHE_LOG_DIR}/error.log\n');
        file('/etc/mysql/my.cnf', '[mysqld]\nbind-address = 127.0.0.1\nport = 3306\ndatadir = /var/lib/mysql\nmax_connections = 151\n');
        file('/etc/apt/sources.list', 'deb http://archive.ubuntu.com/ubuntu noble main restricted universe multiverse\ndeb http://archive.ubuntu.com/ubuntu noble-updates main restricted universe multiverse\ndeb http://security.ubuntu.com/ubuntu noble-security main restricted universe multiverse\n');
        file('/etc/services', 'ftp\t\t21/tcp\nssh\t\t22/tcp\t\t\t\t# SSH Remote Login Protocol\ntelnet\t\t23/tcp\nsmtp\t\t25/tcp\t\tmail\ndomain\t\t53/tcp\nhttp\t\t80/tcp\t\twww\npop3\t\t110/tcp\nimap2\t\t143/tcp\t\timap\nhttps\t\t443/tcp\nmysql\t\t3306/tcp\npostgresql\t5432/tcp\nredis\t\t6379/tcp\n');
        file('/etc/protocols', 'ip\t0\tIP\nicmp\t1\tICMP\ntcp\t6\tTCP\nudp\t17\tUDP\n');
        file('/etc/default/ufw', 'IPV6=yes\nDEFAULT_INPUT_POLICY="DROP"\nDEFAULT_OUTPUT_POLICY="ACCEPT"\n');
        file('/etc/skel/.bashrc', defaultBashrc());
        file('/etc/skel/.profile', defaultProfile());
        file('/etc/systemd/system/backup.service', '[Unit]\nDescription=Nightly backup\n\n[Service]\nType=oneshot\nExecStart=/home/user/scripts/backup.sh\n\n[Install]\nWantedBy=multi-user.target\n');
        // /var
        file('/var/log/syslog', syslog(), 0o640, 'syslog', 'adm');
        file('/var/log/auth.log', authLog(), 0o640, 'syslog', 'adm');
        file('/var/log/kern.log', syslog().split('\n').filter((l) => l.includes('kernel')).join('\n') + '\n', 0o640, 'syslog', 'adm');
        file('/var/log/dmesg', '[    0.000000] Linux version 6.8.0-45-generic (buildd@lcy02-amd64-115) #45-Ubuntu SMP PREEMPT_DYNAMIC\n[    0.000000] Command line: BOOT_IMAGE=/boot/vmlinuz-6.8.0-45-generic root=UUID=3f1c2a9e ro quiet splash\n[    0.004000] DMI: QEMU Standard PC (i440FX + PIIX, 1996)\n[    0.120000] Memory: 8012345K/8388608K available\n[    0.512000] CPU0: Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz (family: 0x6, model: 0x4f)\n[    1.104000] EXT4-fs (sda1): mounted filesystem with ordered data mode\n[    2.300000] e1000: eth0 NIC Link is Up 1000 Mbps Full Duplex\n[    3.500000] audit: type=1400 apparmor="STATUS" operation="profile_load"\n', 0o644);
        file('/var/log/nginx/access.log', accessLog(), 0o640, 'www-data', 'adm');
        file('/var/log/nginx/error.log', '2026/11/04 09:12:44 [error] 641#641: *12 open() "/var/www/html/favicon.ico" failed (2: No such file or directory)\n2026/11/04 09:20:01 [warn] 641#641: *31 upstream response is buffered to a temporary file\n2026/11/04 09:31:17 [error] 641#641: *45 connect() failed (111: Connection refused) while connecting to upstream\n', 0o640, 'www-data', 'adm');
        file('/var/log/apt/history.log', 'Start-Date: 2026-11-01  10:12:01\nCommandline: apt install nginx\nInstall: nginx:amd64 (1.24.0-2ubuntu7)\nEnd-Date: 2026-11-01  10:12:19\n');
        file('/var/log/dpkg.log', '2026-11-01 10:12:05 install nginx:amd64 <none> 1.24.0-2ubuntu7\n2026-11-01 10:12:08 status installed nginx:amd64 1.24.0-2ubuntu7\n');
        file('/var/www/html/index.html', '<!DOCTYPE html>\n<html>\n<head><title>Welcome to nginx!</title></head>\n<body>\n<h1>Welcome to nginx!</h1>\n<p>If you see this page, the nginx web server is successfully installed and working.</p>\n</body>\n</html>\n', 0o644, 'www-data', 'www-data');
        // /proc
        file('/proc/cpuinfo', Array.from({ length: 4 }, (_, i) => 'processor\t: ' + i + '\nvendor_id\t: GenuineIntel\ncpu family\t: 6\nmodel\t\t: 79\nmodel name\t: Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz\ncpu MHz\t\t: 2399.998\ncache size\t: 35840 KB\ncpu cores\t: 4\nflags\t\t: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr sse sse2 ht syscall nx lm avx avx2\n').join('\n'), 0o444);
        file('/proc/meminfo', 'MemTotal:        8124168 kB\nMemFree:         3204112 kB\nMemAvailable:    5876204 kB\nBuffers:          212344 kB\nCached:          2412876 kB\nSwapCached:            0 kB\nActive:          2931040 kB\nInactive:        1452112 kB\nSwapTotal:       2097148 kB\nSwapFree:        2097148 kB\nShmem:             18280 kB\n', 0o444);
        file('/proc/version', 'Linux version 6.8.0-45-generic (buildd@lcy02-amd64-115) (x86_64-linux-gnu-gcc-13 (Ubuntu 13.2.0-23ubuntu4) 13.2.0, GNU ld (GNU Binutils for Ubuntu) 2.42) #45-Ubuntu SMP PREEMPT_DYNAMIC\n', 0o444);
        file('/proc/loadavg', '0.42 0.35 0.28 2/312 2401\n', 0o444);
        file('/proc/uptime', '273420.55 1012034.12\n', 0o444);
        file('/proc/filesystems', 'nodev\tsysfs\nnodev\ttmpfs\nnodev\tproc\n\text4\n\tvfat\nnodev\toverlay\n', 0o444);
        file('/proc/sys/kernel/hostname', HOSTNAME + '\n', 0o644);
        file('/proc/sys/net/ipv4/ip_forward', '0\n', 0o644);
        file('/boot/vmlinuz-6.8.0-45-generic', '\x7fELF kernel image', 0o600);
        file('/boot/initrd.img-6.8.0-45-generic', 'initramfs', 0o644);
        file('/boot/grub/grub.cfg', '# GRUB configuration\nset default=0\nset timeout=5\nmenuentry "Ubuntu" {\n    linux /boot/vmlinuz-6.8.0-45-generic root=UUID=3f1c2a9e ro quiet splash\n}\n', 0o444);
        file('/opt/app/config.yaml', 'app:\n  name: arsenal-api\n  port: 8080\n  log_level: info\ndatabase:\n  host: db.internal\n  port: 5432\n');
        file('/opt/app/run.sh', '#!/bin/bash\necho "Starting arsenal-api on port 8080"\n', 0o755);
        file('/usr/share/dict/words', 'aardvark\nabacus\nabandon\nability\nable\nabout\nabove\nabsent\nabsorb\nabstract\nabsurd\nabuse\naccess\naccident\naccount\naccuse\nachieve\nacid\nacoustic\nacquire\nacross\naction\nactor\nactress\nactual\nadapt\nadd\naddict\naddress\nadjust\nadmit\nadult\nadvance\nadvice\nzebra\nzero\nzone\nzoo\n');
        file('/root/.bashrc', defaultBashrc(true), 0o644);
        file('/root/.profile', defaultProfile(), 0o644);
        file('/root/secret.txt', 'root-only information: the backup password is hunter2\n', 0o600);
        // other users
        for (const u of ['alice', 'bob']) {
            dir('/home/' + u, 0o750, u, u);
            file('/home/' + u + '/.bashrc', defaultBashrc(), 0o644, u, u);
            file('/home/' + u + '/.profile', defaultProfile(), 0o644, u, u);
        }
        file('/home/alice/deploy.sh', '#!/bin/bash\necho "Deploying to production..."\n', 0o750, 'alice', 'alice');
        file('/home/bob/notes.txt', 'Remember to fix the build pipeline.\n', 0o640, 'bob', 'bob');
        dir('/srv/shared', 0o2775, 'root', 'developers');
        file('/srv/shared/README', 'Shared project files for the developers group.\n', 0o664, 'alice', 'developers');
        // user home
        const home = '/home/user';
        dir(home, 0o750, 'user', 'user');
        file(home + '/.bashrc', defaultBashrc(), 0o644, 'user', 'user');
        file(home + '/.profile', defaultProfile(), 0o644, 'user', 'user');
        file(home + '/.bash_logout', '# ~/.bash_logout: executed by bash(1) when login shell exits.\nclear\n', 0o644, 'user', 'user');
        file(home + '/.bash_history', '', 0o600, 'user', 'user');
        file(home + '/.gitconfig', '[user]\n\tname = Linux Arsenal User\n\temail = user@linux-arsenal.dev\n[init]\n\tdefaultBranch = main\n', 0o644, 'user', 'user');
        if (opts.home !== 'empty') {
            for (const [rel, content] of Object.entries(FILES_PRACTICE)) {
                const p = home + '/' + rel;
                const parts = rel.split('/');
                let cur = home;
                for (const seg of parts.slice(0, -1)) { cur += '/' + seg; if (!fs.isDir(cur)) dir(cur, 0o755, 'user', 'user'); }
                const mode = /\.sh$/.test(rel) ? 0o755 : 0o644;
                file(p, content, mode, 'user', 'user');
            }
            dir(home + '/downloads', 0o755, 'user', 'user');
            dir(home + '/.ssh', 0o700, 'user', 'user');
            file(home + '/.ssh/id_ed25519.pub', 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK9xq3mZbP2L4vYwJr8fQ0nE7sGtX1hU5cD6aB9kR0Wz user@linux-arsenal\n', 0o644, 'user', 'user');
            file(home + '/.ssh/id_ed25519', '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\n-----END OPENSSH PRIVATE KEY-----\n', 0o600, 'user', 'user');
            file(home + '/.ssh/known_hosts', '|1|abc123= ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExampleKeyForWeb01\n', 0o644, 'user', 'user');
            file('/tmp/session.lock', '1002\n', 0o644, 'user', 'user');
            file('/tmp/old-cache.tmp', 'stale cache\n', 0o644, 'user', 'user');
            file('/tmp/build.log', 'Build started\nCompiling...\nBuild finished with 2 warnings\n', 0o644, 'user', 'user');
        }
        if (sys) {
            sys.syncFiles(fs);
            for (const g of ['crontabs']) void g;
            file('/var/spool/cron/crontabs/user', sys.crontabs.user, 0o600, 'user', 'crontab');
        }
        return fs;
    }

    function defaultBashrc(root) {
        return '# ~/.bashrc: executed by bash(1) for non-login shells.\n\n# don\'t put duplicate lines in the history\nHISTCONTROL=ignoreboth\nHISTSIZE=1000\nHISTFILESIZE=2000\n\n# enable color support of ls and also add handy aliases\nalias ls=\'ls --color=auto\'\nalias grep=\'grep --color=auto\'\nalias egrep=\'egrep --color=auto\'\nalias fgrep=\'fgrep --color=auto\'\n\n# some more ls aliases\nalias ll=\'ls -alF\'\nalias la=\'ls -A\'\nalias l=\'ls -CF\'\n' + (root ? '' : '\nexport EDITOR=nano\n');
    }
    function defaultProfile() {
        return '# ~/.profile: executed by the command interpreter for login shells.\nif [ -n "$BASH_VERSION" ]; then\n    if [ -f "$HOME/.bashrc" ]; then\n        . "$HOME/.bashrc"\n    fi\nfi\nif [ -d "$HOME/bin" ] ; then\n    PATH="$HOME/bin:$PATH"\nfi\n';
    }

    // ---------------------------------------------------------------- machine factory
    // Creates a complete simulated machine: filesystem + system state + interactive shell
    function createMachine(opts) {
        opts = opts || {};
        const system = createSystemState();
        const fs = opts.fs || buildFilesystem({ system, home: opts.home || 'practice' });
        const shell = new LA.Shell({ fs, system, user: opts.user || 'user', cwd: opts.cwd, ui: opts.ui });
        shell.setVar('BASH_VERSION', '5.2.21(1)-release');
        try { shell.source(shell.home + '/.bashrc', [], { stdin: new LA.Input(''), stdout: new LA.NullWriter(), stderr: new LA.NullWriter() }); } catch (e) { /* no bashrc */ }
        return shell;
    }

    LA.PRACTICE_FILES = FILES_PRACTICE;
    LA.createSystemState = createSystemState;
    LA.buildFilesystem = buildFilesystem;
    LA.createMachine = createMachine;
    LA.HOSTNAME = HOSTNAME;
})();
