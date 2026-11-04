# Linux Arsenal

Learn the Linux command line in a **complete Linux machine that is simulated in your browser**. Nothing touches your real computer. There is no backend, no install, and no network access: open `index.html` and start typing.

## What's inside

### A real terminal emulator
- Readline-style line editing: cursor movement, `Ctrl+A/E/B/F`, `Alt+B/F`, `Ctrl+U/K/W/Y`, `Ctrl+T`, `Alt+.`
- History with `Up`/`Down`, reverse search with `Ctrl+R`, and history expansion (`!!`, `!n`, `!grep`, `!$`, `^old^new`)
- Tab completion for commands, paths, `$VARS`, and git/docker/systemctl/apt subcommands, branches, services, PIDs and users (double-Tab lists every candidate)
- ANSI colors (16/256/truecolor), a colored prompt (`PS1` escapes work), six color schemes, cursor styles
- Multi-line input (unclosed quotes, `\`, `if`/`for`/`while`, here-docs), paste support, `Ctrl+C`, `Ctrl+L`
- Full-screen apps: **nano**, **vim** (modes, counts, `dd yy p u`, `:w :q :wq :q! :%s///g`), **less/more/man** (paging and `/search`), **top/htop** (live, with kill), `sl`, `cmatrix`

### A bash-compatible shell
Pipes, redirection (`> >> < 2> &> 2>&1 <<< <<EOF`), `&& || ;`, background jobs (`&`), quoting, `$VAR`, `${VAR:-x}`, `${#x}`, `${x/a/b}`, `${x^^}`, `$(…)`, backticks, `$((…))`, process substitution `<(…)`, arrays, brace and glob expansion, `if/elif/else`, `for`, C-style `for ((…))`, `while/until`, `case`, functions, `local`, aliases, `.bashrc`, and executable scripts (`chmod +x ./script.sh`). The engine is regression-tested against real GNU bash and coreutils (`tests/bash-diff.test.js`, 231 cases).

### 250+ commands
Files (`ls cp mv rm find tree stat ln du df tar gzip zip`…), text (`grep sed awk sort uniq cut tr wc head tail diff paste xargs column`…, with a full **awk** interpreter), system (`ps top kill systemctl journalctl crontab apt dpkg useradd usermod sudo su`…), networking (`ping ip ss curl wget dig traceroute nmap ssh ufw iptables`…), plus a simulated **git** and **docker**. Every command has a `man` page, `--help`, `tldr` and `examples`.

### 1500+ auto-generated challenges
Challenges cover 16 categories from beginner to expert, including realistic multi-step scenarios such as incident response, deployment, log rotation and user onboarding. Each challenge:
- runs on its **own fresh sandbox machine**
- is verified by **outcome** (the output or the resulting system state) rather than by matching your command text, so any correct approach counts
- has progressive hints and a reference solution

Play them from the Challenges page or directly in the terminal (`challenge random`, `challenge list`, `challenge start 42`). The interactive `tutorial` guides beginners.

### Progress
XP, levels, 35 achievements, streaks, skill bars, analytics, an offline command assistant and settings. Everything is stored in `localStorage`, including your practice machine's files.

## Run locally
```bash
python3 -m http.server 8000   # then open http://localhost:8000
# or simply open index.html in a browser
```

## Tests
```bash
npm test             # all suites
npm run test:unit    # every challenge solvable + not trivially passable, bash differential tests
npm run test:e2e     # headless Chromium end-to-end test (set CHROME=/path/to/chrome if needed)
```

## Layout
```
index.html, style.css, script.js   UI and application controller
js/vfs.js                          virtual filesystem (permissions, symlinks, devices)
js/shell.js                        bash lexer, parser, expansions, executor
js/commands/*.js                   command implementations (files, text, awk, system, network, git/docker)
js/system.js                       simulated machine: base filesystem, users, processes, services, packages, network
js/docs.js                         man pages, --help, tldr, examples
js/challenges.js                   challenge templates, generator, sandbox and verification
js/terminal.js                     terminal emulator and full-screen apps
tests/                             Node and headless-browser test suites
```

Created by **0x0806**.
