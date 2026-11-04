// Linux Arsenal - simulated networking commands (no real network access is ever made)
(function () {
    'use strict';
    const LA = (globalThis.LA = globalThis.LA || {});
    const U = LA.util;
    const { getopt, usageError, register } = U;
    const R = (name, fn, meta) => register(name, fn, meta);
    const NET = () => LA.NET;
    const MY_IP = '192.168.1.100';
    const isRoot = (ctx) => ctx.sh.user === 'root';

    function resolveHost(name) {
        if (!name) return null;
        if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return name;
        const n = name.toLowerCase().replace(/\.$/, '');
        return NET().HOSTS[n] || null;
    }
    function reverseHost(ip) {
        for (const [h, a] of Object.entries(NET().HOSTS)) if (a === ip) return h;
        return null;
    }
    function rttGen(seedStr, base) {
        const rnd = U.mulberry32(U.hashString(seedStr));
        return () => +(base + rnd() * base * 0.25).toFixed(3);
    }
    function baseLatency(ip) {
        if (ip.startsWith('127.')) return 0.03;
        if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) return 0.4;
        return 8 + (U.hashString(ip) % 40);
    }

    // which TCP ports are listening locally
    function listeningPorts(sh) {
        const sys = sh.system;
        const out = [];
        const add = (port, proto, addr, proc, pid, user) => out.push({ port, proto, addr, proc, pid, user });
        if (sys.services.ssh && sys.services.ssh.active) { add(22, 'tcp', '0.0.0.0', 'sshd', 512, 'root'); add(22, 'tcp6', '::', 'sshd', 512, 'root'); }
        if (sys.services.nginx && sys.services.nginx.active) { add(80, 'tcp', '0.0.0.0', 'nginx', 640, 'root'); add(443, 'tcp', '0.0.0.0', 'nginx', 640, 'root'); add(80, 'tcp6', '::', 'nginx', 640, 'root'); }
        if (sys.services.apache2 && sys.services.apache2.active) add(8080, 'tcp6', '::', 'apache2', 1210, 'root');
        if (sys.services.mysql && sys.services.mysql.active) { add(3306, 'tcp', '127.0.0.1', 'mysqld', 1302, 'mysql'); add(33060, 'tcp', '127.0.0.1', 'mysqld', 1302, 'mysql'); }
        if (sys.services['systemd-resolved'] && sys.services['systemd-resolved'].active) { add(53, 'tcp', '127.0.0.53', 'systemd-resolve', 362, 'systemd-resolve'); add(53, 'udp', '127.0.0.53', 'systemd-resolve', 362, 'systemd-resolve'); }
        if (sys.processes.some((p) => p.pid === 2190)) add(3000, 'tcp6', '::', 'node', 2190, 'user');
        if (sys.docker) for (const c of sys.docker.containers) if (c.status === 'running') for (const p of c.ports || []) add(p.host, 'tcp', '0.0.0.0', 'docker-proxy', 900 + c.num, 'root');
        return out;
    }
    LA.listeningPorts = listeningPorts;
    const SERVICE_NAMES = { 22: 'ssh', 53: 'domain', 80: 'http', 443: 'https', 3000: 'hbci', 3306: 'mysql', 5432: 'postgresql', 6379: 'redis', 8080: 'http-alt', 33060: 'mysqlx', 21: 'ftp', 25: 'smtp' };

    // ---------------------------------------------------------------- ping
    R('ping', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'q46nvbDO', args: 'ciWswtI', long: {} });
        if (error) return usageError(ctx, error);
        const host = operands[0];
        if (!host) { ctx.err('ping: usage error: Destination address required\n'); return 2; }
        const ip = resolveHost(host);
        if (!ip) { ctx.err('ping: ' + host + ': ' + (/\./.test(host) ? 'Name or service not known' : 'Temporary failure in name resolution') + '\n'); return 2; }
        const count = opts.c ? parseInt(opts.c, 10) : 4;
        if (!(count > 0)) return ctx.fail('invalid argument: \'' + opts.c + "': out of range: 1 <= value <= 9223372036854775807", 1);
        const size = opts.s ? parseInt(opts.s, 10) : 56;
        ctx.outln('PING ' + host + ' (' + ip + ') ' + size + '(' + (size + 28) + ') bytes of data.');
        const unreachable = NET().UNREACHABLE.has(ip);
        const rtt = rttGen(ip, baseLatency(ip));
        const times = [];
        const n = Math.min(count, 50);
        for (let i = 1; i <= n; i++) {
            if (unreachable) { if (!opts.q) ctx.outln('From ' + MY_IP + ' icmp_seq=' + i + ' Destination Host Unreachable'); continue; }
            const t = rtt();
            times.push(t);
            if (!opts.q) ctx.outln((size + 8) + ' bytes from ' + (opts.n || /^\d/.test(host) ? ip : (reverseHost(ip) || host) + ' (' + ip + ')') + ': icmp_seq=' + i + ' ttl=' + (ip.startsWith('127.') ? 64 : ip.startsWith('192.168') || ip.startsWith('10.') ? 63 : 117) + ' time=' + (t < 1 ? t.toFixed(3) : t.toFixed(1)) + ' ms');
        }
        if (!opts.c && ctx.tty) ctx.outln('^C');
        ctx.outln('');
        ctx.outln('--- ' + host + ' ping statistics ---');
        const recv = times.length;
        ctx.outln(n + ' packets transmitted, ' + recv + ' received, ' + (unreachable ? '+' + n + ' errors, ' : '') + Math.round(((n - recv) / n) * 100) + '% packet loss, time ' + ((n - 1) * 1001 + 3) + 'ms');
        if (recv) {
            const min = Math.min(...times), max = Math.max(...times), avg = times.reduce((a, b) => a + b, 0) / recv;
            const mdev = Math.sqrt(times.reduce((a, b) => a + (b - avg) * (b - avg), 0) / recv);
            ctx.outln('rtt min/avg/max/mdev = ' + [min, avg, max, mdev].map((x) => x.toFixed(3)).join('/') + ' ms');
        }
        return recv ? 0 : 1;
    });

    // ---------------------------------------------------------------- interfaces
    function ifaceBlocks() {
        return {
            eth0: 'eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet ' + MY_IP + '  netmask 255.255.255.0  broadcast 192.168.1.255\n        inet6 fe80::a00:27ff:fe4e:66a1  prefixlen 64  scopeid 0x20<link>\n        ether 08:00:27:4e:66:a1  txqueuelen 1000  (Ethernet)\n        RX packets 184732  bytes 241238811 (241.2 MB)\n        RX errors 0  dropped 0  overruns 0  frame 0\n        TX packets 72114  bytes 8312440 (8.3 MB)\n        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0\n',
            docker0: 'docker0: flags=4099<UP,BROADCAST,MULTICAST>  mtu 1500\n        inet 172.17.0.1  netmask 255.255.0.0  broadcast 172.17.255.255\n        ether 02:42:5c:1d:3a:7e  txqueuelen 0  (Ethernet)\n        RX packets 0  bytes 0 (0.0 B)\n        TX packets 0  bytes 0 (0.0 B)\n',
            lo: 'lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\n        inet 127.0.0.1  netmask 255.0.0.0\n        inet6 ::1  prefixlen 128  scopeid 0x10<host>\n        loop  txqueuelen 1000  (Local Loopback)\n        RX packets 4512  bytes 412331 (412.3 KB)\n        RX errors 0  dropped 0  overruns 0  frame 0\n        TX packets 4512  bytes 412331 (412.3 KB)\n        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0\n'
        };
    }
    R('ifconfig', (ctx) => {
        const b = ifaceBlocks();
        const iface = ctx.args.find((a) => !a.startsWith('-'));
        if (iface) {
            if (!b[iface]) return ctx.fail(iface + ': error fetching interface information: Device not found');
            if (ctx.args.length > 1) { if (!isRoot(ctx)) return ctx.fail('SIOCSIFFLAGS: Operation not permitted', 255); return 0; }
            ctx.out(b[iface]);
            return 0;
        }
        ctx.out([b.docker0, b.eth0, b.lo].join('\n'));
        return 0;
    });
    R('ip', (ctx) => {
        let args = ctx.args.slice();
        const brief = args.includes('-br') || args.includes('-brief');
        const v4 = args.includes('-4');
        const color = args.includes('-c') || args.includes('-color');
        void color;
        args = args.filter((a) => !a.startsWith('-'));
        const obj = args[0] || '';
        const sub = args[1] || 'show';
        const C = ctx.tty ? U.C : { reset: '', green: '', cyan: '', magenta: '', blue: '' };
        if (/^a(d(d(r(e(s(s)?)?)?)?)?)?$/.test(obj)) {
            if (sub === 'add' || sub === 'del') return isRoot(ctx) ? 0 : ctx.fail('RTNETLINK answers: Operation not permitted', 2);
            const filter = args[2] || (sub !== 'show' ? sub : null);
            const ifs = [
                { n: 1, name: 'lo', flags: '<LOOPBACK,UP,LOWER_UP>', mtu: 65536, state: 'UNKNOWN', mac: '00:00:00:00:00:00', link: 'loopback', inet: '127.0.0.1/8', scope: 'host', inet6: '::1/128' },
                { n: 2, name: 'eth0', flags: '<BROADCAST,MULTICAST,UP,LOWER_UP>', mtu: 1500, state: 'UP', mac: '08:00:27:4e:66:a1', link: 'ether', inet: MY_IP + '/24', brd: '192.168.1.255', scope: 'global dynamic eth0', inet6: 'fe80::a00:27ff:fe4e:66a1/64' },
                { n: 3, name: 'docker0', flags: '<NO-CARRIER,BROADCAST,MULTICAST,UP>', mtu: 1500, state: 'DOWN', mac: '02:42:5c:1d:3a:7e', link: 'ether', inet: '172.17.0.1/16', brd: '172.17.255.255', scope: 'global docker0' }
            ].filter((i) => !filter || i.name === filter || (filter === 'dev' && i.name === args[3]));
            if (!ifs.length) return ctx.fail('Device "' + filter + '" does not exist.');
            for (const i of ifs) {
                if (brief) { ctx.outln((C.cyan + i.name + C.reset).padEnd(16 + (ctx.tty ? 9 : 0)) + ' ' + i.state.padEnd(14) + ' ' + i.inet + (i.inet6 && !v4 ? ' ' + i.inet6 : '')); continue; }
                ctx.outln(i.n + ': ' + C.cyan + i.name + C.reset + ': ' + i.flags + ' mtu ' + i.mtu + ' qdisc ' + (i.name === 'lo' ? 'noqueue' : 'fq_codel') + ' state ' + i.state + ' group default qlen 1000');
                ctx.outln('    link/' + i.link + ' ' + C.magenta + i.mac + C.reset + ' brd ' + (i.name === 'lo' ? '00:00:00:00:00:00' : 'ff:ff:ff:ff:ff:ff'));
                ctx.outln('    inet ' + C.magenta + i.inet + C.reset + (i.brd ? ' brd ' + i.brd : '') + ' scope ' + i.scope);
                ctx.outln('       valid_lft forever preferred_lft forever');
                if (i.inet6 && !v4) { ctx.outln('    inet6 ' + i.inet6 + ' scope ' + (i.name === 'lo' ? 'host' : 'link')); ctx.outln('       valid_lft forever preferred_lft forever'); }
            }
            return 0;
        }
        if (/^l(i(n(k)?)?)?$/.test(obj)) {
            if (sub === 'set') return isRoot(ctx) ? 0 : ctx.fail('RTNETLINK answers: Operation not permitted', 2);
            ctx.outln('1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP mode DEFAULT group default qlen 1000\n    link/ether 08:00:27:4e:66:a1 brd ff:ff:ff:ff:ff:ff\n3: docker0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN mode DEFAULT group default\n    link/ether 02:42:5c:1d:3a:7e brd ff:ff:ff:ff:ff:ff');
            return 0;
        }
        if (/^r(o(u(t(e)?)?)?)?$/.test(obj)) {
            if (sub === 'add' || sub === 'del') return isRoot(ctx) ? 0 : ctx.fail('RTNETLINK answers: Operation not permitted', 2);
            if (sub === 'get') { ctx.outln((args[2] || '8.8.8.8') + ' via 192.168.1.1 dev eth0 src ' + MY_IP + ' uid ' + ctx.sh.system.uidOf(ctx.sh.user) + '\n    cache'); return 0; }
            ctx.outln('default via 192.168.1.1 dev eth0 proto dhcp src ' + MY_IP + ' metric 100\n172.17.0.0/16 dev docker0 proto kernel scope link src 172.17.0.1 linkdown\n192.168.1.0/24 dev eth0 proto kernel scope link src ' + MY_IP + ' metric 100\n192.168.1.1 dev eth0 proto dhcp scope link src ' + MY_IP + ' metric 100');
            return 0;
        }
        if (/^n(e(i(g(h(b(o(r)?)?)?)?)?)?)?$/.test(obj)) { ctx.outln('192.168.1.1 dev eth0 lladdr 3c:84:6a:11:22:33 REACHABLE\n192.168.1.15 dev eth0 lladdr 9c:b6:d0:44:55:66 STALE'); return 0; }
        if (!obj) { ctx.err('Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | link | route | neigh | rule | maddress | tunnel }\n'); return 255; }
        return ctx.fail('Object "' + obj + '" is unknown, try "ip help".', 255);
    });
    R('route', (ctx) => { ctx.outln('Kernel IP routing table\nDestination     Gateway         Genmask         Flags Metric Ref    Use Iface\n0.0.0.0         192.168.1.1     0.0.0.0         UG    100    0        0 eth0\n172.17.0.0      0.0.0.0         255.255.0.0     U     0      0        0 docker0\n192.168.1.0     0.0.0.0         255.255.255.0   U     100    0        0 eth0'); return 0; });
    R('arp', (ctx) => {
        if (ctx.args.includes('-a')) { ctx.outln('_gateway (192.168.1.1) at 3c:84:6a:11:22:33 [ether] on eth0\n? (192.168.1.15) at 9c:b6:d0:44:55:66 [ether] on eth0'); return 0; }
        ctx.outln('Address                  HWtype  HWaddress           Flags Mask            Iface\n_gateway                 ether   3c:84:6a:11:22:33   C                     eth0\n192.168.1.15             ether   9c:b6:d0:44:55:66   C                     eth0');
        return 0;
    });

    function socketTable(ctx, style) {
        const { opts } = getopt(ctx.args, { flags: 'tulnpaesrimo4' });
        const sh = ctx.sh;
        const showProc = opts.p;
        const numeric = opts.n;
        let socks = listeningPorts(sh);
        if (!opts.u && opts.t) socks = socks.filter((s) => s.proto !== 'udp');
        if (opts.u && !opts.t) socks = socks.filter((s) => s.proto === 'udp');
        const established = opts.a || (!opts.l && style === 'ss' && !opts.t && !opts.u) ? [{ proto: 'tcp', local: MY_IP + ':22', remote: '192.168.1.15:51022', state: 'ESTAB', proc: 'sshd', pid: 1001, user: 'user' }] : [];
        const portName = (p) => (numeric ? String(p) : SERVICE_NAMES[p] || String(p));
        const procCol = (s) => (showProc ? (isRoot(ctx) || s.user === sh.user ? s.pid + '/' + s.proc : '-') : '');
        if (style === 'netstat') {
            ctx.outln('Active Internet connections ' + (opts.l ? '(only servers)' : '(servers and established)'));
            ctx.outln('Proto Recv-Q Send-Q Local Address           Foreign Address         State      ' + (showProc ? ' PID/Program name' : ''));
            for (const s of socks) {
                const proto = s.proto === 'tcp6' ? 'tcp6' : s.proto;
                const local = (s.addr === '::' ? ':::' : s.addr + ':') + portName(s.port);
                const remote = s.proto === 'tcp6' ? ':::*' : '0.0.0.0:*';
                ctx.outln(proto.padEnd(6) + '0'.padStart(6) + '0'.padStart(7) + ' ' + local.padEnd(23) + ' ' + remote.padEnd(23) + ' ' + (s.proto === 'udp' ? '' : 'LISTEN').padEnd(11) + procCol(s));
            }
            if (!opts.l) for (const e of established) ctx.outln('tcp       0     36 ' + e.local.padEnd(23) + ' ' + e.remote.padEnd(23) + ' ESTABLISHED' + (showProc ? ' ' + (isRoot(ctx) ? e.pid + '/sshd: user' : '-') : ''));
            return 0;
        }
        ctx.outln('Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port' + (showProc ? ' Process' : ''));
        for (const s of socks) {
            const local = (s.addr === '::' ? '[::]' : s.addr) + ':' + portName(s.port);
            ctx.outln((s.proto === 'udp' ? 'udp' : 'tcp').padEnd(5) + ' ' + (s.proto === 'udp' ? 'UNCONN' : 'LISTEN').padEnd(6) + ' 0      ' + (s.proto === 'udp' ? '0' : '4096').padEnd(6) + ' ' + local.padStart(18) + ' ' + (s.addr === '::' ? '[::]:*' : '0.0.0.0:*').padStart(17) + (showProc ? ' ' + (isRoot(ctx) || s.user === sh.user ? 'users:(("' + s.proc + '",pid=' + s.pid + ',fd=3))' : '') : ''));
        }
        for (const e of established) ctx.outln('tcp   ESTAB  0      36     ' + e.local.padStart(18) + ' ' + e.remote.padStart(17));
        return 0;
    }
    R('netstat', (ctx) => {
        if (ctx.args.includes('-r') || ctx.args.includes('-rn')) return LA.commands.route.fn(ctx);
        if (ctx.args.includes('-i')) { ctx.outln('Kernel Interface table\nIface      MTU    RX-OK RX-ERR RX-DRP RX-OVR    TX-OK TX-ERR TX-DRP TX-OVR Flg\ndocker0   1500        0      0      0 0             0      0      0      0 BMU\neth0      1500   184732      0      0 0         72114      0      0      0 BMRU\nlo       65536     4512      0      0 0          4512      0      0      0 LRU'); return 0; }
        return socketTable(ctx, 'netstat');
    });
    R('ss', (ctx) => {
        if (ctx.args.includes('-s')) { ctx.outln('Total: 168\nTCP:   9 (estab 1, closed 0, orphaned 0, timewait 0)\n\nTransport Total     IP        IPv6\nRAW\t  0         0         0\nUDP\t  2         1         1\nTCP\t  9         6         3'); return 0; }
        return socketTable(ctx, 'ss');
    });

    // ---------------------------------------------------------------- DNS
    const MX = { 'google.com': ['10 smtp.google.com.'], 'github.com': ['1 aspmx.l.google.com.', '5 alt1.aspmx.l.google.com.'], 'example.com': ['0 .'] };
    const NS = { 'google.com': ['ns1.google.com.', 'ns2.google.com.'], 'github.com': ['dns1.p08.nsone.net.', 'ns-1283.awsdns-32.org.'], 'example.com': ['a.iana-servers.net.', 'b.iana-servers.net.'] };
    R('nslookup', (ctx) => {
        const ops = ctx.args.filter((a) => !a.startsWith('-'));
        const host = ops[0];
        if (!host) { ctx.outln('> (interactive nslookup is not available; use: nslookup HOST)'); return 1; }
        ctx.outln('Server:\t\t127.0.0.53\nAddress:\t127.0.0.53#53\n');
        if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
            const name = reverseHost(host);
            if (!name) { ctx.outln('** server can\'t find ' + host.split('.').reverse().join('.') + '.in-addr.arpa: NXDOMAIN\n'); return 1; }
            ctx.outln(host.split('.').reverse().join('.') + '.in-addr.arpa\tname = ' + name + '.\n\nAuthoritative answers can be found from:\n');
            return 0;
        }
        const ip = resolveHost(host);
        if (!ip) { ctx.outln("** server can't find " + host + ': NXDOMAIN\n'); return 1; }
        ctx.outln('Non-authoritative answer:\nName:\t' + host + '\nAddress: ' + ip + '\n');
        return 0;
    });
    R('host', (ctx) => {
        const ops = ctx.args.filter((a) => !a.startsWith('-'));
        const host = ops[0];
        if (!host) return usageError(ctx, 'Usage: host [-aCdilrTvVw] [-c class] [-N ndots] [-t type] [-W time] hostname [server]');
        if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
            const name = reverseHost(host);
            if (!name) { ctx.outln('Host ' + host.split('.').reverse().join('.') + '.in-addr.arpa. not found: 3(NXDOMAIN)'); return 1; }
            ctx.outln(host.split('.').reverse().join('.') + '.in-addr.arpa domain name pointer ' + name + '.');
            return 0;
        }
        const ip = resolveHost(host);
        if (!ip) { ctx.outln('Host ' + host + ' not found: 3(NXDOMAIN)'); return 1; }
        ctx.outln(host + ' has address ' + ip);
        for (const m of MX[host] || []) ctx.outln(host + ' mail is handled by ' + m);
        return 0;
    });
    R('dig', (ctx) => {
        const args = ctx.args;
        const short = args.includes('+short');
        let type = 'A';
        let host = null;
        let reverse = false;
        for (let i = 0; i < args.length; i++) {
            const a = args[i];
            if (a.startsWith('+') || a.startsWith('@')) continue;
            if (a === '-x') { reverse = true; host = args[++i]; continue; }
            if (/^(A|AAAA|MX|NS|TXT|CNAME|SOA|ANY|PTR)$/i.test(a)) { type = a.toUpperCase(); continue; }
            if (a === '-t') { type = (args[++i] || 'A').toUpperCase(); continue; }
            host = a;
        }
        if (!host) host = '.';
        let answers = [];
        if (reverse) {
            const name = reverseHost(host);
            if (name) answers.push([host.split('.').reverse().join('.') + '.in-addr.arpa.', 'PTR', name + '.']);
        } else if (type === 'A' || type === 'ANY') {
            const ip = resolveHost(host);
            if (ip) answers.push([host + '.', 'A', ip]);
        } else if (type === 'MX') for (const m of MX[host] || []) answers.push([host + '.', 'MX', m]);
        else if (type === 'NS') for (const m of NS[host] || []) answers.push([host + '.', 'NS', m]);
        else if (type === 'TXT' && resolveHost(host)) answers.push([host + '.', 'TXT', '"v=spf1 -all"']);
        else if (type === 'AAAA' && resolveHost(host)) answers.push([host + '.', 'AAAA', '2606:2800:220:1:248:1893:25c8:' + (U.hashString(host) % 9999).toString(16)]);
        if (short) { for (const a of answers) ctx.outln(a[2]); return 0; }
        const status = answers.length || (type !== 'A' && resolveHost(host)) ? 'NOERROR' : 'NXDOMAIN';
        ctx.outln('\n; <<>> DiG 9.18.28-0ubuntu0.24.04.1-Ubuntu <<>> ' + args.join(' ') + '\n;; global options: +cmd\n;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: ' + status + ', id: ' + (U.hashString(host) % 65535) + '\n;; flags: qr rd ra; QUERY: 1, ANSWER: ' + answers.length + ', AUTHORITY: 0, ADDITIONAL: 1\n\n;; OPT PSEUDOSECTION:\n; EDNS: version: 0, flags:; udp: 65494\n;; QUESTION SECTION:\n;' + (reverse ? host.split('.').reverse().join('.') + '.in-addr.arpa.' : host + '.') + '\t\t\tIN\t' + (reverse ? 'PTR' : type) + '\n');
        if (answers.length) {
            ctx.outln(';; ANSWER SECTION:');
            for (const a of answers) ctx.outln(a[0] + '\t\t' + (300 - (U.hashString(a[2]) % 200)) + '\tIN\t' + a[1] + '\t' + a[2]);
            ctx.outln('');
        }
        ctx.outln(';; Query time: ' + (8 + (U.hashString(host) % 30)) + ' msec\n;; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)\n;; WHEN: ' + U.defaultDate(new Date()) + '\n;; MSG SIZE  rcvd: ' + (40 + answers.length * 16) + '\n');
        return 0;
    });
    R('traceroute', (ctx) => {
        const host = ctx.args.filter((a) => !a.startsWith('-'))[0];
        if (!host) return usageError(ctx, 'Usage: traceroute [ -46dFITnreAUDV ] host');
        const ip = resolveHost(host);
        if (!ip) { ctx.err(host + ': Name or service not known\nCannot handle "host" cmdline arg `' + host + "' on position 1 (argc 1)\n"); return 2; }
        ctx.outln('traceroute to ' + host + ' (' + ip + '), 30 hops max, 60 byte packets');
        const rnd = U.mulberry32(U.hashString(ip));
        const t = (b) => (b + rnd() * 2).toFixed(3) + ' ms';
        const hops = ip.startsWith('127.') ? [[ip, 0.03]] : ip.startsWith('192.168.') || ip.startsWith('10.') ? [['192.168.1.1', 0.4], [ip, 0.8]] : [['192.168.1.1', 0.5], ['10.24.0.1', 4], ['72.14.215.85', 7], ['108.170.252.1', 9], [ip, baseLatency(ip)]];
        if (NET().UNREACHABLE.has(ip)) { ctx.outln(' 1  _gateway (192.168.1.1)  0.512 ms  0.488 ms  0.471 ms\n 2  * * *\n 3  * * *'); return 0; }
        hops.forEach((h, i) => ctx.outln(String(i + 1).padStart(2) + '  ' + (i === 0 && h[0] === '192.168.1.1' ? '_gateway' : reverseHost(h[0]) || h[0]) + ' (' + h[0] + ')  ' + t(h[1]) + '  ' + t(h[1]) + '  ' + t(h[1])));
        return 0;
    });
    LA.commands.tracepath = LA.commands.traceroute;
    R('nmap', (ctx) => {
        const ops = ctx.args.filter((a) => !a.startsWith('-'));
        const target = ops[ops.length - 1];
        if (!target) { ctx.outln('Nmap 7.94SVN ( https://nmap.org )\nUsage: nmap [Scan Type(s)] [Options] {target specification}'); return 0; }
        const host = target.replace(/\/\d+$/, '');
        const ip = resolveHost(host);
        ctx.outln('Starting Nmap 7.94SVN ( https://nmap.org ) at ' + U.strftime('%Y-%m-%d %H:%M UTC', new Date()));
        if (!ip) { ctx.outln('Failed to resolve "' + host + '".\nWARNING: No targets were specified, so 0 hosts scanned.\nNmap done: 0 IP addresses (0 hosts up) scanned in 0.03 seconds'); return 0; }
        if (/\/\d+$/.test(target)) {
            ctx.outln('Nmap scan report for _gateway (192.168.1.1)\nHost is up (0.00051s latency).\nNmap scan report for 192.168.1.15\nHost is up (0.0011s latency).\nNmap scan report for ' + ctx.sh.system.hostname + ' (' + MY_IP + ')\nHost is up (0.000040s latency).\nNmap done: 256 IP addresses (3 hosts up) scanned in 2.41 seconds');
            return 0;
        }
        let ports;
        if (ip.startsWith('127.') || ip === MY_IP) ports = Array.from(new Set(listeningPorts(ctx.sh).filter((s) => s.proto !== 'udp' && (ip === MY_IP ? s.addr !== '127.0.0.1' && s.addr !== '127.0.0.53' : true)).map((s) => s.port))).sort((a, b) => a - b);
        else if (NET().UNREACHABLE.has(ip)) { ctx.outln('Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn\nNmap done: 1 IP address (0 hosts up) scanned in 3.04 seconds'); return 0; }
        else if (ip.startsWith('10.0.0.2')) ports = [22, 5432];
        else if (ip.startsWith('10.0.0.')) ports = [22, 80];
        else ports = [80, 443];
        ctx.outln('Nmap scan report for ' + host + ' (' + ip + ')\nHost is up (' + (baseLatency(ip) / 1000).toFixed(5) + 's latency).');
        ctx.outln('Not shown: ' + (1000 - ports.length) + ' closed tcp ports (conn-refused)\nPORT      STATE SERVICE');
        for (const p of ports) ctx.outln((p + '/tcp').padEnd(9) + ' open  ' + (SERVICE_NAMES[p] || 'unknown'));
        ctx.outln('\nNmap done: 1 IP address (1 host up) scanned in 0.' + (10 + ports.length) + ' seconds');
        return 0;
    }, { pkg: 'nmap' });

    // ---------------------------------------------------------------- HTTP
    function httpFetch(sh, url, method) {
        const m = /^(?:(https?):\/\/)?([^\/:?#]+)(?::(\d+))?([^?#]*)?(\?[^#]*)?/.exec(url);
        if (!m) return { error: 3, msg: 'URL rejected: Malformed input to a URL function' };
        const scheme = m[1] || 'http';
        const host = m[2].toLowerCase();
        const port = m[3] ? parseInt(m[3], 10) : scheme === 'https' ? 443 : 80;
        const path = m[4] || '/';
        const ip = resolveHost(host);
        if (!ip) return { error: 6, msg: 'Could not resolve host: ' + host };
        if (NET().UNREACHABLE.has(ip)) return { error: 28, msg: 'Failed to connect to ' + host + ' port ' + port + ' after 3002 ms: Timeout was reached' };
        const local = ip.startsWith('127.') || ip === MY_IP;
        if (local) {
            const open = listeningPorts(sh).some((s) => s.port === port && s.proto !== 'udp');
            if (!open) return { error: 7, msg: 'Failed to connect to ' + host + ' port ' + port + ' after 0 ms: Couldn\'t connect to server' };
            if (port === 80 || port === 443) {
                let body;
                const filePath = '/var/www/html' + (path === '/' ? '/index.html' : path);
                try { body = LA.asRoot(sh, () => sh.fs.readFile(filePath)); }
                catch (e) { return { status: 404, type: 'text/html', body: '<html>\r\n<head><title>404 Not Found</title></head>\r\n<body>\r\n<center><h1>404 Not Found</h1></center>\r\n<hr><center>nginx/1.24.0 (Ubuntu)</center>\r\n</body>\r\n</html>\r\n', server: 'nginx/1.24.0 (Ubuntu)' }; }
                return { status: 200, type: /\.json$/.test(filePath) ? 'application/json' : /\.txt$/.test(filePath) ? 'text/plain' : 'text/html', body, server: 'nginx/1.24.0 (Ubuntu)' };
            }
            if (port === 3000) return { status: 200, type: 'text/plain', body: 'ok', server: 'Node.js' };
            const c = sh.system.docker && sh.system.docker.containers.find((x) => x.status === 'running' && (x.ports || []).some((p) => p.host === port));
            if (c) return { status: 200, type: 'text/html', body: '<!DOCTYPE html>\n<html><head><title>Welcome to ' + c.image.split(':')[0] + '!</title></head><body><h1>Welcome to ' + c.image.split(':')[0] + '!</h1><p>Served from container ' + c.name + '</p></body></html>\n', server: c.image.split(':')[0] };
            if (port === 8080) return { status: 200, type: 'text/html', body: '<html><body><h1>It works!</h1><p>Apache2 Ubuntu Default Page</p></body></html>\n', server: 'Apache/2.4.58 (Ubuntu)' };
            return { status: 200, type: 'text/plain', body: '', server: 'unknown' };
        }
        const key = host.replace(/^www\./, '') + path;
        const page = NET().WEB[key] || NET().WEB[host + path] || (path === '/' ? NET().WEB[host.replace(/^www\./, '') + '/'] : null);
        if (method === 'POST' && host === 'httpbin.org' && path === '/post') return { status: 200, type: 'application/json', body: '{\n  "args": {},\n  "data": "",\n  "form": {},\n  "url": "https://httpbin.org/post"\n}\n', server: 'gunicorn/19.9.0' };
        if (host === 'httpbin.org' && /^\/status\/(\d{3})$/.test(path)) return { status: parseInt(path.slice(8), 10), type: 'text/html', body: '', server: 'gunicorn/19.9.0' };
        if (!page) {
            if (path === '/') return { status: 200, type: 'text/html', body: '<!doctype html><html><head><title>' + host + '</title></head><body><h1>' + host + '</h1></body></html>\n', server: 'nginx' };
            return { status: 404, type: 'text/html', body: '<!doctype html><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL ' + path + ' was not found on this server.</p></body></html>\n', server: 'nginx' };
        }
        return { status: 200, type: page.type, body: page.body, server: host === 'httpbin.org' ? 'gunicorn/19.9.0' : 'ECS (dcb/7F84)' };
    }
    LA.httpFetch = httpFetch;
    const STATUS_TEXT = { 200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 418: "I'm a teapot", 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable' };
    function headers(res) {
        return 'HTTP/1.1 ' + res.status + ' ' + (STATUS_TEXT[res.status] || '') + '\r\nServer: ' + (res.server || 'nginx') + '\r\nDate: ' + new Date().toUTCString() + '\r\nContent-Type: ' + res.type + (res.type.startsWith('text') ? '; charset=UTF-8' : '') + '\r\nContent-Length: ' + LA.VFS.utf8Length(res.body) + '\r\nConnection: keep-alive\r\n\r\n';
    }
    R('curl', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, {
            flags: 'sSLIiOvfkgG#', args: 'oXdHwAuxmTe', multi: ['H', 'd'],
            long: { silent: 's', 'show-error': 'S', location: 'L', head: 'I', include: 'i', 'remote-name': 'O', verbose: 'v', fail: 'f', insecure: 'k', output: 'o=', request: 'X=', data: 'd=', header: 'H=', 'write-out': 'w=', 'user-agent': 'A=', user: 'u=', 'max-time': 'm=', 'data-raw': 'd=', json: 'json=', version: 'V' }
        });
        if (error) return usageError(ctx, error);
        if (opts.V) { ctx.outln('curl 8.5.0 (x86_64-pc-linux-gnu) libcurl/8.5.0 OpenSSL/3.0.13 zlib/1.3\nProtocols: dict file ftp ftps gopher gophers http https imap imaps ldap ldaps mqtt pop3 pop3s rtsp scp sftp smb smbs smtp smtps telnet tftp\nFeatures: alt-svc AsynchDNS HSTS HTTP2 HTTPS-proxy IDN IPv6 Largefile libz NTLM SSL threadsafe TLS-SRP UnixSockets'); return 0; }
        const url = operands[0];
        if (!url) { ctx.err('curl: try \'curl --help\' or \'curl --manual\' for more information\n'); return 2; }
        if (/^file:\/\//.test(url)) {
            try { ctx.out(ctx.fs.readFile(url.slice(7))); return 0; } catch (e) { return ctx.fail('(37) Couldn\'t open file ' + url.slice(7), 37); }
        }
        const method = opts.X || (opts.d || opts.json ? 'POST' : opts.I ? 'HEAD' : 'GET');
        const res = httpFetch(ctx.sh, url, method);
        if (opts.v) {
            const m = /^(?:(https?):\/\/)?([^\/:?#]+)/.exec(url);
            ctx.err('*   Trying ' + (resolveHost(m[2]) || m[2]) + ':' + (m[1] === 'https' ? 443 : 80) + '...\n* Connected to ' + m[2] + '\n> ' + method + ' ' + (url.replace(/^https?:\/\/[^\/]+/, '') || '/') + ' HTTP/1.1\n> Host: ' + m[2] + '\n> User-Agent: ' + (opts.A || 'curl/8.5.0') + '\n> Accept: */*\n>\n');
        }
        if (res.error) {
            if (!opts.s || opts.S) ctx.err('curl: (' + res.error + ') ' + res.msg + '\n');
            return res.error;
        }
        if (opts.f && res.status >= 400) { if (!opts.s || opts.S) ctx.err('curl: (22) The requested URL returned error: ' + res.status + '\n'); return 22; }
        let out = '';
        if (opts.I) out = headers(res);
        else { if (opts.i) out += headers(res); out += res.body; }
        if (opts.v && !opts.I) ctx.err(headers(res).split('\r\n').filter(Boolean).map((l) => '< ' + l).join('\n') + '\n<\n');
        let target = opts.o;
        if (opts.O) { const name = url.replace(/[?#].*$/, '').split('/').pop(); if (!name) return ctx.fail('(23) Failed writing body', 23); target = name; }
        if (target && target !== '-') {
            try { ctx.fs.writeFile(ctx.resolve(target), out); }
            catch (e) { return ctx.fail('(23) Failed writing body', 23); }
            if (!opts.s && ctx.io.ttyErr) ctx.err('  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100  ' + String(out.length).padStart(4) + '  100  ' + String(out.length).padStart(4) + '    0     0   9' + (out.length % 900) + 'k      0 --:--:-- --:--:-- --:--:--  9' + (out.length % 900) + 'k\n');
        } else ctx.out(out);
        if (opts.w) ctx.out(LA.shellUtil.unescapeC(opts.w.replace(/%\{http_code\}/g, String(res.status)).replace(/%\{size_download\}/g, String(res.body.length)).replace(/%\{content_type\}/g, res.type).replace(/%\{time_total\}/g, '0.0' + (12 + (res.body.length % 80))).replace(/%\{url_effective\}/g, url)));
        return 0;
    });
    R('wget', (ctx) => {
        const { opts, operands, error } = getopt(ctx.args, { flags: 'qcvnNSrk', args: 'OPtT', long: { quiet: 'q', 'output-document': 'O=', 'directory-prefix': 'P=', continue: 'c', 'no-verbose': 'nv', spider: 'spider' } });
        if (error) return usageError(ctx, error);
        const url = operands[0];
        if (!url) { ctx.err('wget: missing URL\nUsage: wget [OPTION]... [URL]...\n\nTry `wget --help\' for more options.\n'); return 1; }
        const full = /^https?:\/\//.test(url) ? url : 'http://' + url;
        const m = /^(https?):\/\/([^\/:?#]+)(?::(\d+))?([^?#]*)/.exec(full);
        const host = m[2];
        const say = (s) => { if (!opts.q) ctx.err(s + '\n'); };
        const now = U.isoDate(Date.now());
        say('--' + now + '--  ' + full);
        const ip = resolveHost(host);
        const res = httpFetch(ctx.sh, full, 'GET');
        if (res.error === 6) { say('Resolving ' + host + ' (' + host + ')... failed: Name or service not known.\nwget: unable to resolve host address ‘' + host + '’'); return 4; }
        say('Resolving ' + host + ' (' + host + ')... ' + ip);
        const port = m[3] || (m[1] === 'https' ? 443 : 80);
        if (res.error) { say('Connecting to ' + host + ' (' + host + ')|' + ip + '|:' + port + '... failed: ' + (res.error === 7 ? 'Connection refused.' : 'Connection timed out.')); return 4; }
        say('Connecting to ' + host + ' (' + host + ')|' + ip + '|:' + port + '... connected.');
        say((m[1] === 'https' ? 'HTTP' : 'HTTP') + ' request sent, awaiting response... ' + res.status + ' ' + (STATUS_TEXT[res.status] || ''));
        if (res.status >= 400) { say(U.isoDate(Date.now()) + ' ERROR ' + res.status + ': ' + (STATUS_TEXT[res.status] || '') + '.\n'); return 8; }
        if (opts.spider) { say('Remote file exists.\n'); return 0; }
        const len = LA.VFS.utf8Length(res.body);
        let name = opts.O || (m[4] && m[4] !== '/' ? m[4].split('/').pop() : '') || 'index.html';
        if (!opts.O && opts.P) name = opts.P.replace(/\/$/, '') + '/' + name;
        if (!opts.O && ctx.fs.exists(ctx.resolve(name)) && !opts.c) {
            let k = 1;
            while (ctx.fs.exists(ctx.resolve(name + '.' + k))) k++;
            name = name + '.' + k;
        }
        say('Length: ' + len + ' (' + U.humanSize(len) + ') [' + res.type + ']\nSaving to: ‘' + name + '’\n');
        try {
            if (name === '-') ctx.out(res.body);
            else ctx.fs.writeFile(ctx.resolve(name), res.body);
        } catch (e) { say(name + ': ' + e.message); return 3; }
        say(name.padEnd(20).slice(0, 20) + '100%[===================>]   ' + U.humanSize(len).padStart(5) + '  --.-KB/s    in 0s      \n\n' + U.isoDate(Date.now()) + ' (' + (5 + (len % 40)) + '.' + (len % 10) + ' MB/s) - ‘' + name + '’ saved [' + len + '/' + len + ']\n');
        return 0;
    });

    // ---------------------------------------------------------------- remote access
    R('ssh', (ctx) => {
        const ops = ctx.args.filter((a, i) => !a.startsWith('-') && !['-p', '-i', '-l', '-o'].includes(ctx.args[i - 1]));
        if (ctx.args.includes('-V')) { ctx.err('OpenSSH_9.6p1 Ubuntu-3ubuntu13, OpenSSL 3.0.13 30 Jan 2024\n'); return 0; }
        const target = ops[0];
        if (!target) { ctx.err('usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [-b bind_address]\n           [-c cipher_spec] [-D [bind_address:]port] [-E log_file]\n           [-i identity_file] [-J destination] [-L address]\n           [-l login_name] [-p port] destination [command [argument ...]]\n'); return 255; }
        const host = target.includes('@') ? target.split('@')[1] : target;
        const user = target.includes('@') ? target.split('@')[0] : ctx.sh.user;
        const ip = resolveHost(host);
        if (!ip) { ctx.err('ssh: Could not resolve hostname ' + host + ': Name or service not known\n'); return 255; }
        if (NET().UNREACHABLE.has(ip)) { ctx.err('ssh: connect to host ' + host + ' port 22: Connection timed out\n'); return 255; }
        if (ip.startsWith('127.') || ip === MY_IP) {
            if (!ctx.sh.system.services.ssh.active) { ctx.err('ssh: connect to host ' + host + ' port 22: Connection refused\n'); return 255; }
            if (!ctx.sh.system.userExists(user)) { ctx.err(user + '@' + host + ': Permission denied (publickey,password).\n'); return 255; }
            const cmd = ops.slice(1).join(' ');
            if (cmd) {
                const prev = ctx.sh.user;
                ctx.sh.user = user; ctx.sh.applyUser();
                try { return ctx.run(cmd); } finally { ctx.sh.user = prev; ctx.sh.applyUser(); }
            }
            ctx.outln('Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-45-generic x86_64)\n\nLast login: ' + U.defaultDate(new Date(Date.now() - 3600000)) + ' from 192.168.1.15');
            ctx.sh.switchUser(user, true);
            return 0;
        }
        ctx.err("The authenticity of host '" + host + ' (' + ip + ")' can't be established.\nED25519 key fingerprint is SHA256:" + LA.b64.encode(host).slice(0, 43) + '.\nThis key is not known by any other names.\n' + user + '@' + host + ': Permission denied (publickey).\n(Remote hosts are simulated: only localhost accepts logins in the sandbox.)\n');
        return 255;
    });
    R('scp', (ctx) => {
        const ops = ctx.args.filter((a) => !a.startsWith('-'));
        if (ops.length < 2) { ctx.err('usage: scp [-346ABCOpqRrsTv] [-c cipher] [-D sftp_server_path] [-F ssh_config]\n           [-i identity_file] [-J destination] [-l limit] [-o ssh_option]\n           [-P port] [-S program] [-X sftp_option] source ... target\n'); return 1; }
        const remote = ops.find((o) => /^[^\/]*:/.test(o));
        if (remote) {
            const host = remote.split(':')[0].split('@').pop();
            if (!['localhost', '127.0.0.1'].includes(host)) { ctx.err('ssh: connect to host ' + host + ' port 22: Connection refused\nscp: Connection closed\n'); return 255; }
        }
        const strip = (p) => p.replace(/^[^\/]*:/, '');
        return ctx.exec(['cp'].concat(ctx.args.includes('-r') ? ['-r'] : []).concat(ops.map(strip)));
    });
    R('nc', (ctx) => {
        const flags = ctx.args.filter((a) => a.startsWith('-')).join('');
        const ops = ctx.args.filter((a) => !a.startsWith('-'));
        if (flags.includes('l')) { ctx.err('nc: listening is not supported in the sandbox (no real sockets)\n'); return 1; }
        const [host, portSpec] = ops;
        if (!host || !portSpec) { ctx.err('usage: nc [-46CDdFhklNnrStUuvZz] [-I length] [-i interval] [-M ttl]\n\t  [-m minttl] [-O length] [-P proxy_username] [-p source_port]\n\t  [-q seconds] [-s sourceaddr] [-T keyword] [-V rtable] [-W recvlimit]\n\t  [-w timeout] [-X proxy_protocol] [-x proxy_address[:port]]\n\t  [destination] [port]\n'); return 1; }
        const ip = resolveHost(host);
        if (!ip) { ctx.err('nc: getaddrinfo for host "' + host + '" port ' + portSpec + ': Name or service not known\n'); return 1; }
        const ports = portSpec.includes('-') ? (() => { const [a, b] = portSpec.split('-').map(Number); const r = []; for (let p = a; p <= b && r.length < 1000; p++) r.push(p); return r; })() : [parseInt(portSpec, 10)];
        let ok = false;
        for (const port of ports) {
            let open;
            if (ip.startsWith('127.') || ip === MY_IP) open = listeningPorts(ctx.sh).some((s) => s.port === port && s.proto !== 'udp');
            else open = !NET().UNREACHABLE.has(ip) && [22, 80, 443].includes(port);
            if (open) { ok = true; if (flags.includes('v') || flags.includes('z')) ctx.err('Connection to ' + host + ' (' + ip + ') ' + port + ' port [tcp/' + (SERVICE_NAMES[port] || '*') + '] succeeded!\n'); }
            else if (flags.includes('v') && ports.length === 1) ctx.err('nc: connect to ' + host + ' (' + ip + ') port ' + port + ' (tcp) failed: Connection refused\n');
        }
        return ok ? 0 : 1;
    });
    R('telnet', (ctx) => {
        const [host, port] = ctx.args;
        if (!host) { ctx.outln('telnet> (interactive telnet is not available)'); return 1; }
        const ip = resolveHost(host);
        ctx.outln('Trying ' + (ip || host) + '...');
        if (!ip) { ctx.err('telnet: could not resolve ' + host + '/' + (port || 'telnet') + ': Name or service not known\n'); return 1; }
        const p = parseInt(port || '23', 10);
        const open = ip.startsWith('127.') ? listeningPorts(ctx.sh).some((s) => s.port === p) : [22, 80, 443].includes(p);
        if (!open) { ctx.err('telnet: Unable to connect to remote host: Connection refused\n'); return 1; }
        ctx.outln('Connected to ' + host + '.\nEscape character is \'^]\'.' + (p === 22 ? '\nSSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13' : '') + '\nConnection closed by foreign host.');
        return 0;
    });

    // ---------------------------------------------------------------- firewall
    R('ufw', (ctx) => {
        const fw = ctx.sh.system.firewall;
        const a = ctx.args;
        if (!isRoot(ctx)) { ctx.err('ERROR: You need to be root to run this script\n'); return 1; }
        const verb = a[0];
        const ruleOf = (action, spec) => {
            const m = /^(\d+|[a-z]+)(?:\/(tcp|udp))?$/i.exec(spec || '');
            if (!m) return null;
            const known = { ssh: '22/tcp', http: '80/tcp', https: '443/tcp', mysql: '3306/tcp' };
            const port = /^\d+$/.test(m[1]) ? m[1] + (m[2] ? '/' + m[2] : '') : (known[m[1].toLowerCase()] || null);
            if (!port) return null;
            return port + ' ' + action.toUpperCase() + ' IN Anywhere';
        };
        switch (verb) {
            case 'status': {
                if (!fw.enabled) { ctx.outln('Status: inactive'); return 0; }
                ctx.outln('Status: active');
                if (a[1] === 'verbose') ctx.outln('Logging: on (low)\nDefault: deny (incoming), allow (outgoing), disabled (routed)\nNew profiles: skip');
                ctx.outln('\n' + (a[1] === 'numbered' ? '     ' : '') + 'To                         Action      From\n' + (a[1] === 'numbered' ? '     ' : '') + '--                         ------      ----');
                fw.rules.forEach((r, i) => { const [to, act, , from] = r.split(' '); ctx.outln((a[1] === 'numbered' ? '[' + String(i + 1).padStart(2) + '] ' : '') + to.padEnd(26) + ' ' + (act + (a[1] === 'numbered' ? ' IN' : '')).padEnd(11) + ' ' + from); });
                return 0;
            }
            case 'enable': fw.enabled = true; ctx.outln('Firewall is active and enabled on system startup'); return 0;
            case 'disable': fw.enabled = false; ctx.outln('Firewall stopped and disabled on system startup'); return 0;
            case 'reload': ctx.outln(fw.enabled ? 'Firewall reloaded' : 'Firewall not enabled (skipping reload)'); return 0;
            case 'reset': fw.rules = []; fw.enabled = false; ctx.outln('Resetting all rules to installed defaults. Proceed with operation (y|n)? y\nBacking up \'user.rules\' to \'/etc/ufw/user.rules.' + U.strftime('%Y%m%d_%H%M%S', new Date()) + '\''); return 0;
            case 'allow': case 'deny': case 'reject': case 'limit': {
                const spec = a[1] === 'in' || a[1] === 'out' ? a[2] : a[1];
                let rule = ruleOf(verb, spec);
                if (a[1] === 'from' && a[2]) rule = 'Anywhere ' + verb.toUpperCase() + ' IN ' + a[2];
                if (!rule) return ctx.fail('ERROR: Could not find a profile matching \'' + (spec || '') + "'");
                if (fw.rules.includes(rule)) { ctx.outln('Skipping adding existing rule'); return 0; }
                fw.rules = fw.rules.filter((r) => r.split(' ')[0] !== rule.split(' ')[0] || r.split(' ')[1] === rule.split(' ')[1]);
                fw.rules.push(rule);
                ctx.outln('Rule added\nRule added (v6)');
                return 0;
            }
            case 'delete': {
                let idx = -1;
                if (/^\d+$/.test(a[1])) idx = parseInt(a[1], 10) - 1;
                else { const rule = ruleOf(a[1], a[2]); idx = fw.rules.indexOf(rule); }
                if (idx < 0 || idx >= fw.rules.length) return ctx.fail('Could not delete non-existent rule');
                fw.rules.splice(idx, 1);
                ctx.outln('Rule deleted\nRule deleted (v6)');
                return 0;
            }
            case 'app': ctx.outln('Available applications:\n  Nginx Full\n  Nginx HTTP\n  Nginx HTTPS\n  OpenSSH'); return 0;
        }
        ctx.err('ERROR: Invalid syntax\n\nUsage: ufw COMMAND\n\nCommands:\n enable\t\t\t\tenables the firewall\n disable\t\t\tdisables the firewall\n status\t\t\t\tshow firewall status\n allow ARGS\t\t\tadd allow rule\n deny ARGS\t\t\tadd deny rule\n delete RULE|NUM\t\tdelete RULE\n');
        return 1;
    });
    R('iptables', (ctx) => {
        if (!isRoot(ctx)) { ctx.err('iptables v1.8.10 (nf_tables): Could not fetch rule set generation id: Permission denied (you must be root)\n'); return 4; }
        const sys = ctx.sh.system;
        sys.iptables = sys.iptables || { INPUT: [], FORWARD: [], OUTPUT: [], policy: { INPUT: 'ACCEPT', FORWARD: 'ACCEPT', OUTPUT: 'ACCEPT' } };
        const t = sys.iptables;
        const a = ctx.args;
        const get = (flag) => { const i = a.indexOf(flag); return i >= 0 ? a[i + 1] : undefined; };
        if (a.includes('-L') || a.includes('--list') || a.includes('-S') || !a.length) {
            const chains = ['INPUT', 'FORWARD', 'OUTPUT'];
            const only = get('-L');
            if (a.includes('-S')) { for (const c of chains) { ctx.outln('-P ' + c + ' ' + t.policy[c]); } for (const c of chains) for (const r of t[c]) ctx.outln('-A ' + c + ' ' + r.spec); return 0; }
            const list = only && chains.includes(only) ? [only] : chains;
            list.forEach((c, i) => {
                if (i) ctx.outln('');
                ctx.outln('Chain ' + c + ' (policy ' + t.policy[c] + ')\ntarget     prot opt source               destination');
                for (const r of t[c]) ctx.outln(r.target.padEnd(10) + ' ' + r.prot.padEnd(4) + ' --  ' + 'anywhere'.padEnd(20) + ' anywhere' + ' '.repeat(13) + (r.dport ? r.prot + ' dpt:' + (a.includes('-n') ? r.dport : SERVICE_NAMES[r.dport] || r.dport) : ''));
            });
            return 0;
        }
        if (a.includes('-F')) { t.INPUT = []; t.FORWARD = []; t.OUTPUT = []; return 0; }
        if (get('-P')) { t.policy[get('-P')] = a[a.indexOf('-P') + 2]; return 0; }
        const chain = get('-A') || get('-I') || get('-D');
        if (!chain || !t[chain]) return ctx.fail("iptables: Chain '" + (chain || '') + "' does not exist", 1);
        const rule = { target: get('-j') || 'ACCEPT', prot: get('-p') || 'all', dport: get('--dport'), spec: a.filter((x) => !['-A', '-I', '-D', chain].includes(x)).join(' ') };
        if (get('-D')) {
            const i = t[chain].findIndex((r) => r.spec === rule.spec);
            if (i < 0) return ctx.fail('iptables: Bad rule (does a matching rule exist in that chain?).', 1);
            t[chain].splice(i, 1);
            return 0;
        }
        if (get('-I')) t[chain].unshift(rule); else t[chain].push(rule);
        return 0;
    });
})();
