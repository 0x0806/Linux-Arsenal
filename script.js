class LinuxArsenal {
    constructor() {
        this.currentSection = 'dashboard';
        this.user = {
            xp: 0,
            level: 1,
            streak: 0,
            commandsLearned: 0,
            timeSpent: 0,
            accuracy: 0,
            skills: {
                'file-ops': 0,
                'text-proc': 0,
                'sys-admin': 0,
                'networking': 0,
                'security': 0,
                'scripting': 0
            }
        };
        this.commandHistory = [];
        this.currentChallenge = null;
        this.achievements = [];
        this.leaderboard = [];
        this.filesystem = this.initializeFilesystem();
        this.currentDirectory = '/home/user';
        this.challenges = [];
        this.aiAssistantOpen = true;

        this.generateChallenges();
        this.initializeApp();
        this.loadUserData();
        this.setupEventListeners();
        this.initializeAchievements();
        this.updateLeaderboard();
    }

    initializeApp() {
        // Show loading screen
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            this.updateDashboard();
        }, 2000);
    }

    loadUserData() {
        const savedData = localStorage.getItem('linuxArsenalUser');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.user = { ...this.user, ...data };
            
            // Restore completed challenges
            if (data.completedChallenges) {
                data.completedChallenges.forEach(challengeId => {
                    const challenge = this.challenges.find(c => c.id === challengeId);
                    if (challenge) {
                        challenge.completed = true;
                    }
                });
            }
        }
        this.updateUserDisplay();
    }

    saveUserData() {
        const userData = {
            ...this.user,
            completedChallenges: this.challenges.filter(c => c.completed).map(c => c.id)
        };
        localStorage.setItem('linuxArsenalUser', JSON.stringify(userData));
    }

    updateUserDisplay() {
        document.getElementById('user-xp').textContent = this.user.xp;
        document.getElementById('user-level').textContent = this.user.level;
        
        // Update header streak
        const headerStreak = document.getElementById('header-streak');
        if (headerStreak) {
            headerStreak.textContent = this.user.streak;
        }
        
        // Update progress bars with animation
        Object.keys(this.user.skills).forEach(skill => {
            const level = Math.floor(this.user.skills[skill] / 100) + 1;
            const progress = (this.user.skills[skill] % 100);
            const progressBar = document.querySelector(`[data-skill="${skill}"]`);
            const levelText = progressBar?.parentElement?.nextElementSibling;
            const percentageText = progressBar?.parentElement?.parentElement?.querySelector('.progress-percentage');

            if (progressBar) {
                progressBar.style.width = progress + '%';
                if (levelText) levelText.textContent = `Level ${level}`;
                if (percentageText) percentageText.textContent = progress + '%';
            }
        });
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.switchSection(section);
            });
        });

        // Terminal input
        const terminalInput = document.getElementById('terminal-input');
        terminalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.processCommand(e.target.value.trim());
                e.target.value = '';
            }
        });

        terminalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                this.handleTabCompletion(e.target);
            }
        });

        // Terminal actions
        document.getElementById('clear-terminal').addEventListener('click', () => {
            this.clearTerminal();
        });

        document.getElementById('terminal-help').addEventListener('click', () => {
            this.showTerminalHelp();
        });

        const fullscreenBtn = document.getElementById('fullscreen-terminal');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }

        const minimizeBtn = document.getElementById('minimize-terminal');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                this.minimizeTerminal();
            });
        }

        const restoreBtn = document.getElementById('restore-terminal');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => {
                this.restoreTerminal();
            });
        }

        // AI suggestion buttons
        document.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const suggestion = e.target.dataset.suggestion;
                const chatInput = document.getElementById('chat-input');
                chatInput.value = suggestion;
                this.sendAIMessage();
            });
        });

        // AI Assistant
        document.getElementById('toggle-assistant').addEventListener('click', () => {
            this.toggleAIAssistant();
        });

        document.getElementById('send-message').addEventListener('click', () => {
            this.sendAIMessage();
        });

        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendAIMessage();
            }
        });

        const minimizeAssistant = document.getElementById('minimize-assistant');
        if (minimizeAssistant) {
            minimizeAssistant.addEventListener('click', (e) => {
                e.stopPropagation();
                this.minimizeAIAssistant();
            });
        }

        // Challenge modal
        document.getElementById('close-challenge').addEventListener('click', () => {
            this.closeChallenge();
        });

        // Challenge filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterChallenges(e.target.dataset.filter);
            });
        });

        // Challenge search
        const challengeSearch = document.getElementById('challenge-search');
        if (challengeSearch) {
            challengeSearch.addEventListener('input', (e) => {
                this.searchChallenges(e.target.value);
            });
        }

        // Generate new challenge button
        const generateBtn = document.getElementById('generate-challenge');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateRandomChallenge();
            });
        }

        // Load more challenges
        const loadMoreBtn = document.getElementById('load-more-challenges');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMoreChallenges();
            });
        }

        // Auto-save user data
        setInterval(() => {
            this.saveUserData();
        }, 30000);
    }

    switchSection(section) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Update content sections
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
        });
        document.getElementById(`${section}-section`).classList.add('active');

        this.currentSection = section;

        // Load section-specific content
        switch (section) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'challenges':
                this.loadChallenges();
                break;
            case 'achievements':
                this.loadAchievements();
                break;
            case 'leaderboard':
                this.updateLeaderboard();
                break;
        }
    }

    updateDashboard() {
        // Update stats
        document.getElementById('streak-count').textContent = this.user.streak;
        document.getElementById('commands-learned').textContent = this.user.commandsLearned;
        document.getElementById('time-spent').textContent = Math.floor(this.user.timeSpent / 60) + 'h';
        document.getElementById('accuracy-rate').textContent = this.user.accuracy + '%';

        // Update skill progress
        Object.keys(this.user.skills).forEach(skill => {
            const level = Math.floor(this.user.skills[skill] / 100) + 1;
            const progress = (this.user.skills[skill] % 100);
            const progressBar = document.querySelector(`[data-skill="${skill}"]`);
            const levelText = progressBar.parentElement.nextElementSibling;

            if (progressBar) {
                progressBar.style.width = progress + '%';
                levelText.textContent = `Level ${level}`;
            }
        });

        // Update activity
        this.updateActivityFeed();

        // Challenge completion update
        const totalChallenges = this.challenges.length;
        const completedChallenges = this.challenges.filter(c => c.completed).length;
        const successRate = totalChallenges > 0 ? Math.round((completedChallenges / totalChallenges) * 100) : 0;

        document.getElementById('total-challenges').textContent = totalChallenges;
        document.getElementById('completed-challenges').textContent = completedChallenges;
        document.getElementById('success-rate').textContent = successRate + '%';
    }

    updateActivityFeed() {
        const activityList = document.getElementById('activity-list');
        const activities = this.getRecentActivities();

        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <i class="${activity.icon}"></i>
                <span>${activity.text}</span>
            </div>
        `).join('');
    }

    getRecentActivities() {
        const activities = [];

        if (this.user.commandsLearned > 0) {
            activities.push({
                icon: 'fas fa-terminal',
                text: `Learned ${this.user.commandsLearned} Linux commands`
            });
        }

        if (this.user.streak > 0) {
            activities.push({
                icon: 'fas fa-fire',
                text: `Maintained ${this.user.streak} day learning streak`
            });
        }

        return activities.length > 0 ? activities : [{
            icon: 'fas fa-play-circle',
            text: 'Welcome to Linux Arsenal! Start your journey.'
        }];
    }

    // Terminal System
    initializeFilesystem() {
        return {
            '/': {
                type: 'directory',
                children: {
                    'home': {
                        type: 'directory',
                        children: {
                            'user': {
                                type: 'directory',
                                children: {
                                    'documents': {
                                        type: 'directory',
                                        children: {
                                            'readme.txt': {
                                                type: 'file',
                                                content: 'Welcome to Linux Arsenal!\nThis is your home directory.'
                                            }
                                        }
                                    },
                                    'projects': {
                                        type: 'directory',
                                        children: {}
                                    },
                                    '.bashrc': {
                                        type: 'file',
                                        content: '# Bash configuration file\nexport PS1="user@linux-arsenal:~$ "'
                                    }
                                }
                            }
                        }
                    },
                    'etc': {
                        type: 'directory',
                        children: {
                            'passwd': {
                                type: 'file',
                                content: 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:user:/home/user:/bin/bash'
                            }
                        }
                    },
                    'var': {
                        type: 'directory',
                        children: {
                            'log': {
                                type: 'directory',
                                children: {
                                    'system.log': {
                                        type: 'file',
                                        content: 'System log entries...'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
    }

    processCommand(command) {
        if (!command) return;

        this.addToHistory(command);
        this.addCommandToOutput(command);

        // Handle pipes and redirects
        if (command.includes('|') || command.includes('>') || command.includes('>>')) {
            const result = this.processPipeline(command);
            this.addOutputToTerminal(result.output, result.isError);
            this.updateCommandHints();
            this.trackCommandUsage(command.split(' ')[0].toLowerCase(), !result.isError);
            this.updateUserProgress(command.split(' ')[0].toLowerCase(), !result.isError);
            return;
        }

        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        let output = '';
        let isError = false;

        try {
            switch (cmd) {
                case 'help':
                    output = this.getHelpText();
                    break;
                case 'tutorial':
                    output = this.startTutorial();
                    break;
                case 'ls':
                    output = this.listFiles(args);
                    break;
                case 'cd':
                    output = this.changeDirectory(args[0] || '~');
                    break;
                case 'pwd':
                    output = this.currentDirectory;
                    break;
                case 'cat':
                    output = this.readFile(args[0]);
                    break;
                case 'mkdir':
                    output = this.makeDirectory(args[0]);
                    break;
                case 'rmdir':
                    output = this.removeDirectory(args[0]);
                    break;
                case 'touch':
                    output = this.createFile(args[0]);
                    break;
                case 'rm':
                    output = this.removeFile(args);
                    break;
                case 'cp':
                    output = this.copyFile(args[0], args[1]);
                    break;
                case 'mv':
                    output = this.moveFile(args[0], args[1]);
                    break;
                case 'grep':
                    output = this.grepCommand(args);
                    break;
                case 'find':
                    output = this.findCommand(args);
                    break;
                case 'echo':
                    output = args.join(' ');
                    break;
                case 'whoami':
                    output = 'user';
                    break;
                case 'date':
                    output = new Date().toString();
                    break;
                case 'uname':
                    output = 'Linux linux-arsenal 5.4.0-74-generic #83-Ubuntu SMP Sat May 8 02:35:39 UTC 2021 x86_64 x86_64 x86_64 GNU/Linux';
                    break;
                case 'clear':
                    this.clearTerminal();
                    return;
                case 'history':
                    output = this.showHistory();
                    break;
                case 'man':
                    output = this.showManual(args[0]);
                    break;
                case 'wc':
                    output = this.wordCount(args);
                    break;
                case 'head':
                    output = this.headCommand(args);
                    break;
                case 'tail':
                    output = this.tailCommand(args);
                    break;
                case 'sort':
                    output = this.sortCommand(args);
                    break;
                default:
                    output = `Command '${cmd}' not found. Type 'help' for available commands.`;
                    isError = true;
            }
        } catch (error) {
            output = `Error: ${error.message}`;
            isError = true;
        }

        this.addOutputToTerminal(output, isError);
        this.updateCommandHints();
        this.trackCommandUsage(cmd, !isError);
        this.updateUserProgress(cmd, !isError);
    }

    addCommandToOutput(command) {
        const output = document.getElementById('terminal-output');
        const commandDiv = document.createElement('div');
        commandDiv.className = 'command-line';
        const promptSpan = document.createElement('span');
        promptSpan.className = 'command-prompt';
        promptSpan.textContent = `user@linux-arsenal:${this.getDisplayPath()}$`;
        const textSpan = document.createElement('span');
        textSpan.className = 'command-text';
        textSpan.textContent = command;
        commandDiv.appendChild(promptSpan);
        commandDiv.appendChild(textSpan);
        output.appendChild(commandDiv);
        output.scrollTop = output.scrollHeight;
    }

    addOutputToTerminal(output, isError = false) {
        const outputDiv = document.getElementById('terminal-output');
        const resultDiv = document.createElement('div');
        resultDiv.className = isError ? 'command-error' : 'command-result';
        resultDiv.textContent = output;
        outputDiv.appendChild(resultDiv);
        outputDiv.scrollTop = outputDiv.scrollHeight;
    }

    getDisplayPath() {
        return this.currentDirectory.replace('/home/user', '~');
    }

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    addToHistory(command) {
        this.commandHistory.push(command);
        if (this.commandHistory.length > 100) {
            this.commandHistory = this.commandHistory.slice(-100);
        }
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        const historyContent = document.getElementById('history-content');
        if (!historyContent) return;
        const recentCommands = this.commandHistory.slice(-10).reverse();
        historyContent.innerHTML = recentCommands.map(cmd =>
            `<div class="history-item">${this.escapeHtml(cmd)}</div>`
        ).join('') || '<div class="history-item">No commands yet</div>';
    }

    // File system operations
    listFiles(args) {
        const showHidden = args.includes('-a');
        const longFormat = args.includes('-l');
        const recursive = args.includes('-R');
        const path = args.find(arg => !arg.startsWith('-')) || this.currentDirectory;
        const resolvedPath = this.resolvePath(path);
        const node = this.getNode(resolvedPath);
        if (!node) throw new Error(`ls: cannot access '${path}': No such file or directory`);
        if (node.type !== 'directory') return path;
        const items = Object.keys(node.children).filter(name => showHidden || !name.startsWith('.')).sort();
        if (longFormat) {
            return items.map(name => {
                const child = node.children[name];
                const type = child.type === 'directory' ? 'd' : '-';
                const perms = 'rwxr-xr-x';
                const size = child.content ? child.content.length : 4096;
                return `${type}${perms} 1 user user ${String(size).padStart(8)} Jan 1 12:00 ${name}`;
            }).join('\n');
        }
        return items.join('  ');
    }

    changeDirectory(path) {
        if (path === '~' || path === '') { this.currentDirectory = '/home/user'; return ''; }
        const resolvedPath = this.resolvePath(path);
        const node = this.getNode(resolvedPath);
        if (!node) throw new Error(`cd: ${path}: No such file or directory`);
        if (node.type !== 'directory') throw new Error(`cd: ${path}: Not a directory`);
        this.currentDirectory = resolvedPath;
        return '';
    }

    readFile(filename) {
        if (!filename) throw new Error('cat: missing file operand');
        const path = this.resolvePath(filename);
        const node = this.getNode(path);
        if (!node) throw new Error(`cat: ${filename}: No such file or directory`);
        if (node.type !== 'file') throw new Error(`cat: ${filename}: Is a directory`);
        return node.content || '';
    }

    makeDirectory(dirname) {
        if (!dirname) throw new Error('mkdir: missing operand');
        const path = this.resolvePath(dirname);
        const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
        const dirName = path.substring(path.lastIndexOf('/') + 1);
        const parentNode = this.getNode(parentPath);
        if (!parentNode || parentNode.type !== 'directory') throw new Error(`mkdir: cannot create directory '${dirname}': No such file or directory`);
        if (parentNode.children[dirName]) throw new Error(`mkdir: cannot create directory '${dirname}': File exists`);
        parentNode.children[dirName] = { type: 'directory', children: {} };
        return '';
    }

    createFile(filename) {
        if (!filename) throw new Error('touch: missing file operand');
        const path = this.resolvePath(filename);
        const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
        const fileName = path.substring(path.lastIndexOf('/') + 1);
        const parentNode = this.getNode(parentPath);
        if (!parentNode || parentNode.type !== 'directory') throw new Error(`touch: cannot touch '${filename}': No such file or directory`);
        if (!parentNode.children[fileName]) parentNode.children[fileName] = { type: 'file', content: '' };
        return '';
    }

    removeFile(args) {
        if (!args || args.length === 0) throw new Error('rm: missing operand');
        const filename = args[0];
        const recursive = args.includes('-r') || args.includes('-rf');
        const path = this.resolvePath(filename);
        const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
        const fileName = path.substring(path.lastIndexOf('/') + 1);
        const parentNode = this.getNode(parentPath);
        if (!parentNode || parentNode.type !== 'directory') throw new Error(`rm: cannot remove '${filename}': No such file or directory`);
        const targetNode = parentNode.children[fileName];
        if (!targetNode) throw new Error(`rm: cannot remove '${filename}': No such file or directory`);
        if (targetNode.type === 'directory' && !recursive) throw new Error(`rm: cannot remove '${filename}': Is a directory`);
        delete parentNode.children[fileName];
        return '';
    }

    copyFile(source, destination) {
        if (!source || !destination) throw new Error('cp: missing file operand');
        const srcPath = this.resolvePath(source);
        const srcNode = this.getNode(srcPath);
        if (!srcNode) throw new Error(`cp: cannot stat '${source}': No such file or directory`);
        const dstPath = this.resolvePath(destination);
        const dstParentPath = dstPath.substring(0, dstPath.lastIndexOf('/')) || '/';
        const dstFileName = dstPath.substring(dstPath.lastIndexOf('/') + 1);
        const dstParentNode = this.getNode(dstParentPath);
        if (!dstParentNode || dstParentNode.type !== 'directory') throw new Error(`cp: cannot create regular file '${destination}': No such file or directory`);
        dstParentNode.children[dstFileName] = { type: 'file', content: srcNode.content || '' };
        return '';
    }

    moveFile(source, destination) {
        if (!source || !destination) throw new Error('mv: missing file operand');
        this.copyFile(source, destination);
        this.removeFile([source]);
        return '';
    }

    removeDirectory(dirname) {
        if (!dirname) throw new Error('rmdir: missing operand');
        const path = this.resolvePath(dirname);
        const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
        const dirName = path.substring(path.lastIndexOf('/') + 1);
        const parentNode = this.getNode(parentPath);
        if (!parentNode || parentNode.type !== 'directory') throw new Error(`rmdir: failed to remove '${dirname}': No such file or directory`);
        const targetNode = parentNode.children[dirName];
        if (!targetNode) throw new Error(`rmdir: failed to remove '${dirname}': No such file or directory`);
        if (targetNode.type !== 'directory') throw new Error(`rmdir: failed to remove '${dirname}': Not a directory`);
        if (Object.keys(targetNode.children).length > 0) throw new Error(`rmdir: failed to remove '${dirname}': Directory not empty`);
        delete parentNode.children[dirName];
        return '';
    }

    grepCommand(args) {
        if (args.length < 2) throw new Error('grep: missing pattern or file');
        const pattern = args[0];
        const filename = args[1];
        const path = this.resolvePath(filename);
        const node = this.getNode(path);
        if (!node) throw new Error(`grep: ${filename}: No such file or directory`);
        if (node.type !== 'file') throw new Error(`grep: ${filename}: Is a directory`);
        const content = node.content || '';
        const lines = content.split('\n');
        const matches = lines.filter(line => line.includes(pattern));
        return matches.join('\n');
    }

    findCommand(args) {
        const path = args[0] || this.currentDirectory;
        const namePattern = args.includes('-name') ? args[args.indexOf('-name') + 1] : '*';
        const results = [];
        const search = (currentPath, node) => {
            if (node.type === 'file') {
                if (namePattern === '*' || currentPath.includes(namePattern.replace('*', ''))) results.push(currentPath);
            } else if (node.type === 'directory') {
                Object.keys(node.children).forEach(childName => {
                    const childPath = currentPath + (currentPath.endsWith('/') ? '' : '/') + childName;
                    search(childPath, node.children[childName]);
                });
            }
        };
        const startNode = this.getNode(this.resolvePath(path));
        if (startNode) search(path, startNode);
        return results.join('\n');
    }

    wordCount(args) {
        if (!args || args.length === 0) throw new Error('wc: missing file operand');
        const filename = args.find(arg => !arg.startsWith('-')) || args[args.length - 1];
        const path = this.resolvePath(filename);
        const node = this.getNode(path);
        if (!node) throw new Error(`wc: ${filename}: No such file or directory`);
        if (node.type !== 'file') throw new Error(`wc: ${filename}: Is a directory`);
        const content = node.content || '';
        const lines = content.split('\n').length;
        const words = content.split(/\s+/).filter(w => w.length > 0).length;
        const chars = content.length;
        if (args.includes('-l')) return String(lines);
        if (args.includes('-w')) return String(words);
        if (args.includes('-c')) return String(chars);
        return `${lines} ${words} ${chars} ${filename}`;
    }

    headCommand(args) {
        if (!args || args.length === 0) throw new Error('head: missing file operand');
        let numLines = 10;
        let filename = args[args.length - 1];
        const nIndex = args.indexOf('-n');
        if (nIndex !== -1 && args[nIndex + 1]) { numLines = parseInt(args[nIndex + 1]); }
        else { const numberFlag = args.find(a => a.match(/^-\d+$/)); if (numberFlag) numLines = parseInt(numberFlag.substring(1)); }
        const path = this.resolvePath(filename);
        const node = this.getNode(path);
        if (!node) throw new Error(`head: ${filename}: No such file or directory`);
        if (node.type !== 'file') throw new Error(`head: ${filename}: Is a directory`);
        return (node.content || '').split('\n').slice(0, numLines).join('\n');
    }

    tailCommand(args) {
        if (!args || args.length === 0) throw new Error('tail: missing file operand');
        let numLines = 10;
        let filename = args[args.length - 1];
        const nIndex = args.indexOf('-n');
        if (nIndex !== -1 && args[nIndex + 1]) { numLines = parseInt(args[nIndex + 1]); }
        else { const numberFlag = args.find(a => a.match(/^-\d+$/)); if (numberFlag) numLines = parseInt(numberFlag.substring(1)); }
        const path = this.resolvePath(filename);
        const node = this.getNode(path);
        if (!node) throw new Error(`tail: ${filename}: No such file or directory`);
        if (node.type !== 'file') throw new Error(`tail: ${filename}: Is a directory`);
        return (node.content || '').split('\n').slice(-numLines).join('\n');
    }

    sortCommand(args) {
        if (!args || args.length === 0) throw new Error('sort: missing file operand');
        const filename = args.find(a => !a.startsWith('-')) || args[args.length - 1];
        const reverse = args.includes('-r');
        const path = this.resolvePath(filename);
        const node = this.getNode(path);
        if (!node) throw new Error(`sort: ${filename}: No such file or directory`);
        if (node.type !== 'file') throw new Error(`sort: ${filename}: Is a directory`);
        let lines = (node.content || '').split('\n');
        lines.sort();
        if (reverse) lines.reverse();
        return lines.join('\n');
    }

    resolvePath(path) {
        if (path.startsWith('/')) return path;
        if (path === '~') return '/home/user';
        if (path.startsWith('~/')) return '/home/user' + path.substring(1);
        if (path === '..') { const parts = this.currentDirectory.split('/'); parts.pop(); return parts.join('/') || '/'; }
        if (path.startsWith('../')) { const parts = this.currentDirectory.split('/'); parts.pop(); return (parts.join('/') || '/') + path.substring(2); }
        if (path === '.') return this.currentDirectory;
        if (path.startsWith('./')) return this.currentDirectory + path.substring(1);
        return this.currentDirectory + (this.currentDirectory.endsWith('/') ? '' : '/') + path;
    }

    getNode(path) {
        if (!path || path === '/') return this.filesystem['/'];
        const parts = path.split('/').filter(p => p);
        let node = this.filesystem['/'];
        for (const part of parts) {
            if (!node || !node.children || !node.children[part]) return null;
            node = node.children[part];
        }
        return node;
    }

    formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    getHelpText() {
        return `Available Commands:
Navigation: ls, cd, pwd, find, tree
File Ops: cat, touch, mkdir, rmdir, rm, cp, mv, ln, stat, file, basename, dirname
Text Processing: grep, echo, wc, head, tail, sort, tr, cut, uniq, rev, nl, diff, tee, strings
Permissions: chmod, chown, id, groups, who
System: whoami, date, uname, ps, du, df, free, uptime, top, kill, env, export, alias, cal, seq
Network: ping, netstat, ifconfig, wget, curl, ssh
Archives: tar
Service: systemctl, journalctl, dmesg, lscpu, lsblk
Crypto: md5sum, base64
Fun: neofetch, cowsay, figlet, cmatrix, sl
Other: help, tutorial, clear, history, man, time, sleep, yes, watch
Use | to pipe commands, > or >> to redirect output to files`;
    }

    startTutorial() {
        return `Welcome to the Linux Arsenal Tutorial!
1. Type: pwd (see where you are)
2. Type: ls (list files)
3. Type: ls -l (detailed listing)
4. Type: cd documents (change directory)
5. Type: cd .. (go back)
Type 'help' anytime for all commands.`;
    }

    showHistory() {
        return this.commandHistory.map((cmd, i) => `${i + 1}  ${cmd}`).join('\n');
    }

    showManual(command) {
        const manuals = {
            ls: `ls - list directory contents\nUsage: ls [OPTION]... [FILE]...\nOptions: -a (all), -l (long format), -R (recursive)`,
            cd: `cd - change directory\nUsage: cd [DIRECTORY]\nUse ~ for home, .. for parent, - for previous`,
            cat: `cat - concatenate and display files\nUsage: cat [FILE]...`,
            pwd: `pwd - print working directory\nUsage: pwd`,
            grep: `grep - search for patterns in files\nUsage: grep [PATTERN] [FILE]\nOptions: -i (ignore case), -n (line numbers), -c (count), -r (recursive)`,
            chmod: `chmod - change file permissions\nUsage: chmod [MODE] [FILE]\nNumeric: 755=rwxr-xr-x, 644=rw-r--r--, 600=rw-------\nSymbolic: u+x, g-w, o=r`,
            find: `find - search for files\nUsage: find [PATH] -name [PATTERN]\nOptions: -type f (files), -type d (dirs), -mtime -7 (modified<7d)`,
            ps: `ps - report process status\nUsage: ps [OPTIONS]\nCommon: ps aux (all processes), ps -ef (full format)`,
            tar: `tar - archive utility\nUsage: tar -czf [ARCHIVE] [FILES] (create)\n       tar -xzf [ARCHIVE] (extract)\nOptions: -c (create), -x (extract), -z (gzip), -f (file)`,
            man: `man - display manual pages\nUsage: man [COMMAND]`
        };
        return manuals[command] || `No manual entry for ${command}`;
    }

    clearTerminal() {
        document.getElementById('terminal-output').innerHTML = '';
    }

    showTerminalHelp() {
        this.addOutputToTerminal(this.getHelpText());
    }

    updateCommandHints() {
        const hints = [
            "Try 'ls -la' to see hidden files with details",
            "Use 'cd ..' to go up one directory",
            "Tab key auto-completes commands and filenames",
            "Use 'history' to see previous commands",
            "Pipe commands: ls -la | grep '.txt'",
            "Redirect output: echo hello > file.txt",
            "Try 'neofetch' for system info display",
            "Use 'man [command]' for detailed help"
        ];
        const hintContent = document.getElementById('hint-content');
        if (hintContent) hintContent.textContent = hints[Math.floor(Math.random() * hints.length)];
    }

    handleTabCompletion(input) {
        const value = input.value;
        const parts = value.split(' ');
        const lastPart = parts[parts.length - 1];
        if (parts.length === 1) {
            const commands = ['ls','cd','pwd','cat','mkdir','touch','rm','cp','mv','grep','find','echo','help','history','man','clear','sort','wc','head','tail','rmdir','whoami','date','uname','chmod','chown','ln','tar','ps','du','df','free','uptime','top','kill','ping','netstat','ifconfig','env','export','alias','diff','tee','tr','cut','uniq','rev','nl','stat','file','tree','cal','seq','neofetch','cowsay','figlet','base64','md5sum','strings','watch','time','sleep','yes','sudo','su','nano','vim','wget','curl','ssh','systemctl','journalctl','dmesg','lscpu','lsblk','tutorial'];
            const matches = commands.filter(c => c.startsWith(lastPart));
            if (matches.length === 1) input.value = matches[0] + ' ';
            else if (matches.length > 1) this.addOutputToTerminal(matches.join('  '));
        } else {
            const node = this.getNode(this.currentDirectory);
            if (node && node.children) {
                const matches = Object.keys(node.children).filter(n => n.startsWith(lastPart));
                if (matches.length === 1) { parts[parts.length - 1] = matches[0]; input.value = parts.join(' ') + ' '; }
                else if (matches.length > 1) this.addOutputToTerminal(matches.join('  '));
            }
        }
    }

    // Pipe and redirect processing
    processPipeline(command) {
        try {
            if (command.includes('>>')) {
                const [left, right] = command.split('>>').map(s => s.trim());
                const output = this.executeSingleCommand(left);
                const filename = right.trim();
                const path = this.resolvePath(filename);
                const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
                const fileName = path.substring(path.lastIndexOf('/') + 1);
                const parentNode = this.getNode(parentPath);
                if (parentNode && parentNode.type === 'directory') {
                    if (parentNode.children[fileName]) {
                        parentNode.children[fileName].content = (parentNode.children[fileName].content || '') + '\n' + output;
                    } else {
                        parentNode.children[fileName] = { type: 'file', content: output };
                    }
                }
                return { output: '', isError: false };
            } else if (command.includes('>')) {
                const [left, right] = command.split('>').map(s => s.trim());
                const output = this.executeSingleCommand(left);
                const filename = right.trim();
                const path = this.resolvePath(filename);
                const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
                const fileName = path.substring(path.lastIndexOf('/') + 1);
                const parentNode = this.getNode(parentPath);
                if (parentNode && parentNode.type === 'directory') {
                    parentNode.children[fileName] = { type: 'file', content: output };
                }
                return { output: '', isError: false };
            } else if (command.includes('|')) {
                const stages = command.split('|').map(s => s.trim());
                let currentOutput = '';
                for (let i = 0; i < stages.length; i++) {
                    if (i === 0) {
                        currentOutput = this.executeSingleCommand(stages[i]);
                    } else {
                        currentOutput = this.executePipeStage(stages[i], currentOutput);
                    }
                }
                return { output: currentOutput, isError: false };
            }
        } catch (error) {
            return { output: `Error: ${error.message}`, isError: true };
        }
        return { output: '', isError: false };
    }

    executeSingleCommand(command) {
        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        return this.executeCommandInternal(cmd, args);
    }

    executePipeStage(stage, input) {
        const parts = stage.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        switch (cmd) {
            case 'grep': {
                const pattern = args.find(a => !a.startsWith('-'));
                const flags = args.filter(a => a.startsWith('-'));
                let lines = input.split('\n');
                if (flags.includes('-i')) lines = lines.filter(l => l.toLowerCase().includes(pattern.toLowerCase()));
                else lines = lines.filter(l => l.includes(pattern));
                if (flags.includes('-c')) return String(lines.length);
                if (flags.includes('-n')) return lines.map((l, i) => `${i + 1}:${l}`).join('\n');
                return lines.join('\n');
            }
            case 'wc': {
                const lines = input.split('\n').length;
                const words = input.split(/\s+/).filter(w => w.length > 0).length;
                const chars = input.length;
                if (args.includes('-l')) return String(lines);
                if (args.includes('-w')) return String(words);
                if (args.includes('-c')) return String(chars);
                return `${lines} ${words} ${chars}`;
            }
            case 'sort': { let l = input.split('\n'); l.sort(); if (args.includes('-r')) l.reverse(); return l.join('\n'); }
            case 'head': { const n = parseInt(args[args.indexOf('-n') + 1] || args.find(a => a.match(/^-\d+$/))?.substring(1) || 10); return input.split('\n').slice(0, n).join('\n'); }
            case 'tail': { const n = parseInt(args[args.indexOf('-n') + 1] || args.find(a => a.match(/^-\d+$/))?.substring(1) || 10); return input.split('\n').slice(-n).join('\n'); }
            case 'uniq': { return [...new Set(input.split('\n'))].join('\n'); }
            case 'tr': {
                if (args.length >= 2) { return input.split(args[0]).join(args[1]); }
                return input;
            }
            case 'rev': { return input.split('\n').map(l => l.split('').reverse().join('')).join('\n'); }
            case 'cut': {
                if (args.includes('-d') && args.includes('-f')) { const delim = args[args.indexOf('-d') + 1]; const field = parseInt(args[args.indexOf('-f') + 1]) - 1; return input.split('\n').map(l => l.split(delim)[field] || '').join('\n'); }
                return input;
            }
            case 'nl': { return input.split('\n').map((l, i) => `     ${i + 1}\t${l}`).join('\n'); }
            case 'tee': { return input; }
            default: return input;
        }
    }

    executeCommandInternal(cmd, args) {
        switch (cmd) {
            case 'ls': return this.listFiles(args);
            case 'cd': this.changeDirectory(args[0] || '~'); return '';
            case 'pwd': return this.currentDirectory;
            case 'cat': return this.readFile(args[0]);
            case 'echo': return args.join(' ');
            case 'whoami': return 'user';
            case 'date': return new Date().toString();
            case 'uname': return args.includes('-a') ? 'Linux linux-arsenal 5.4.0-74-generic #83-Ubuntu SMP x86_64 GNU/Linux' : 'Linux';
            case 'history': return this.showHistory();
            case 'find': return this.findCommand(args);
            case 'wc': return this.wordCount(args);
            case 'head': return this.headCommand(args);
            case 'tail': return this.tailCommand(args);
            case 'sort': return this.sortCommand(args);
            case 'grep': return this.grepCommand(args);
            case 'ps': return this.psCommand(args);
            case 'du': return this.duCommand(args);
            case 'df': return this.dfCommand(args);
            case 'free': return this.freeCommand(args);
            case 'uptime': return this.uptimeCommand();
            case 'top': return this.topCommand();
            case 'ifconfig': return this.ifconfigCommand();
            case 'netstat': return this.netstatCommand(args);
            case 'env': case 'printenv': return this.envCommand(args);
            case 'id': return 'uid=1000(user) gid=1000(user) groups=1000(user),27(sudo)';
            case 'groups': return 'user : user adm cdrom sudo dip plugdev lpadmin sambashare';
            case 'who': return 'user    pts/0        ' + new Date().toLocaleString();
            case 'neofetch': return this.neofetchCommand();
            default: return `Command '${cmd}' executed`;
        }
    }

    // New command implementations
    chmodCommand(args) {
        if (args.length < 2) return 'chmod: missing operand\nUsage: chmod [MODE] [FILE]';
        const mode = args[0];
        const filename = args[1];
        const path = this.resolvePath(filename);
        const node = this.getNode(path);
        if (!node) return `chmod: cannot access '${filename}': No such file or directory`;
        return `Changed permissions of '${filename}' to ${mode}`;
    }

    chownCommand(args) {
        if (args.length < 2) return 'chown: missing operand\nUsage: chown [OWNER] [FILE]';
        return `Changed ownership of '${args[1]}' to ${args[0]}`;
    }

    lnCommand(args) {
        if (args.length < 2) return 'ln: missing operand\nUsage: ln -s [TARGET] [LINKNAME]';
        const symbolic = args.includes('-s');
        if (symbolic) return `Created symbolic link '${args[args.length - 1]}' -> '${args[args.length - 2]}'`;
        return `Created hard link '${args[args.length - 1]}' -> '${args[args.length - 2]}'`;
    }

    tarCommand(args) {
        if (args.length === 0) return 'tar: missing operand';
        if (args.includes('-c')) return `Created archive: ${args[args.length - 1]}`;
        if (args.includes('-x')) return `Extracted archive: ${args[args.length - 1]}`;
        if (args.includes('-t')) return `Contents of archive:\n  file1.txt\n  file2.txt\n  documents/`;
        return 'tar: try -czf (create) or -xzf (extract)';
    }

    psCommand(args) {
        if (args.includes('aux') || args.includes('-ef') || args.includes('-e')) {
            return `USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\nroot         1  0.0  0.1 169372 13240 ?        Ss   09:00   0:01 /sbin/init\nroot         2  0.0  0.0      0     0 ?        S    09:00   0:00 [kthreadd]\nuser      1001  0.1  0.5 23456 10240 pts/0    Ss   09:01   0:00 -bash\nuser      1052  0.0  0.2 18652  4608 pts/0    R+   09:15   0:00 ps aux`;
        }
        return `  PID TTY          TIME CMD\n 1001 pts/0    00:00:00 bash\n 1052 pts/0    00:00:00 ps`;
    }

    duCommand(args) {
        const humanReadable = args.includes('-h');
        const path = args.find(a => !a.startsWith('-')) || '.';
        if (humanReadable) {
            return `4.0K\t${path}/.bashrc\n4.0K\t${path}/documents\n8.0K\t${path}/documents/readme.txt\n4.0K\t${path}/projects\n24K\t${path}`;
        }
        return `4096\t${path}/.bashrc\n4096\t${path}/documents\n8192\t${path}/documents/readme.txt\n4096\t${path}/projects\n24576\t${path}`;
    }

    dfCommand(args) {
        if (args.includes('-h')) {
            return `Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda2        50G   18G   30G  38% /\ntmpfs           2.0G  1.2M  2.0G   1% /dev/shm\n/dev/sda1       512M  35M  477M   7% /boot`;
        }
        return `Filesystem     1K-blocks    Used Available Use% Mounted on\n/dev/sda2       52428800 18874368 33554432  38% /\ntmpfs             2097152    1200   2095952   1% /dev/shm\n/dev/sda1         524288    35840   488448   7% /boot`;
    }

    freeCommand(args) {
        if (args.includes('-h')) {
            return `              total        used        free      shared  buff/cache   available\nMem:           3.8Gi       1.2Gi       1.8Gi       120Mi       780Mi       2.3Gi\nSwap:          2.0Gi          0B       2.0Gi`;
        }
        return `              total        used        free      shared  buff/cache   available\nMem:        3994960     1258292     1887432      122880      819200     2411728\nSwap:       2097152           0     2097152`;
    }

    uptimeCommand() {
        return ' ' + new Date().toLocaleTimeString() + ' up  3:42,  1 user,  load average: 0.08, 0.04, 0.01';
    }

    topCommand() {
        return `top - ${new Date().toLocaleTimeString()} up  3:42,  1 user,  load average: 0.08, 0.04, 0.01\nTasks:  87 total,   1 running,  86 sleeping,   0 stopped,   0 zombie\n%Cpu(s):  0.3 us,  0.3 sy,  0.0 ni, 99.3 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st\nMiB Mem :   3900.0 total,   1845.0 free,   1228.0 used,    827.0 buff/cache\n\n  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND\n 1001 user      20   0   23456  10240   6144 S   0.0  0.3   0:00.01 bash\n 1052 user      20   0   18652   4608   3072 R   0.0  0.1   0:00.00 top`;
    }

    killCommand(args) {
        if (!args[0]) return 'kill: usage: kill [-s SIGNAL] PID...';
        const pid = args.find(a => !a.startsWith('-'));
        return `Killed process ${pid}`;
    }

    pingCommand(args) {
        const host = args.find(a => !a.startsWith('-')) || 'localhost';
        const count = args.includes('-c') ? parseInt(args[args.indexOf('-c') + 1]) : 4;
        let result = `PING ${host} (127.0.0.1) 56(84) bytes of data.\n`;
        for (let i = 0; i < count; i++) {
            result += `64 bytes from ${host}: icmp_seq=${i + 1} ttl=64 time=0.0${Math.floor(Math.random() * 9) + 1} ms\n`;
        }
        result += `\n--- ${host} ping statistics ---\n${count} packets transmitted, ${count} received, 0% packet loss, time ${count * 1000}ms`;
        return result;
    }

    netstatCommand(args) {
        if (args.includes('-tuln') || args.includes('-tulpn')) {
            return `Active Internet connections (only servers)\nProto Recv-Q Send-Q Local Address           Foreign Address         State       \ntcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      \ntcp        0      0 127.0.0.1:5432          0.0.0.0:*               LISTEN      \ntcp6       0      0 :::80                   :::*                    LISTEN      \ntcp6       0      0 :::443                  :::*                    LISTEN      \nudp        0      0 0.0.0.0:68              0.0.0.0:*                           `;
        }
        return `Active Internet connections (w/o servers)\nProto Recv-Q Send-Q Local Address           Foreign Address         State\nActive UNIX domain sockets (w/o servers)\nProto RefCnt Flags       Type       State         I-Node   Path`;
    }

    ifconfigCommand() {
        return `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet 192.168.1.100  netmask 255.255.255.0  broadcast 192.168.1.255\n        inet6 fe80::a00:27ff:fe4e:66a1  prefixlen 64  scopeid 0x20<link>\n        ether 08:00:27:4e:66:a1  txqueuelen 1000  (Ethernet)\n        RX packets 1234  bytes 567890 (567.8 KB)\n        TX packets 987  bytes 345678 (345.6 KB)\n\nlo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\n        inet 127.0.0.1  netmask 255.0.0.0\n        loop  txqueuelen 1000  (Local Loopback)`;
    }

    envCommand(args) {
        if (args[0]) return process.env[args[0]] || '';
        return `SHELL=/bin/bash\nTERM=xterm-256color\nUSER=user\nPATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin\nPWD=${this.currentDirectory}\nHOME=/home/user\nLANG=en_US.UTF-8\nDISPLAY=:0\nEDITOR=vim`;
    }

    exportCommand(args) {
        if (!args[0]) return '';
        return '';
    }

    aliasCommand(args) {
        if (!args[0]) return `alias ll='ls -l'\nalias la='ls -a'\nalias l='ls -CF'\nalias ..='cd ..'\nalias ...='cd ../..'`;
        return '';
    }

    diffCommand(args) {
        if (args.length < 2) return 'diff: missing operand';
        const file1 = this.readFile(args[0]);
        const file2 = this.readFile(args[1]);
        if (file1 === file2) return '';
        return `1c1\n< ${file1.split('\n')[0]}\n---\n> ${file2.split('\n')[0]}`;
    }

    teeCommand(args) {
        if (!args[0]) return 'tee: missing operand';
        return '';
    }

    trCommand(args) {
        if (args.length < 2) return 'tr: missing operand\nUsage: tr [SET1] [SET2]';
        return '';
    }

    cutCommand(args) {
        if (!args[0]) return 'cut: missing operand';
        return '';
    }

    uniqCommand(args) {
        if (!args[0]) return '';
        const content = this.readFile(args.find(a => !a.startsWith('-')));
        return [...new Set(content.split('\n'))].join('\n');
    }

    revCommand(args) {
        if (!args[0]) return 'rev: missing operand';
        const content = this.readFile(args[0]);
        return content.split('\n').map(l => l.split('').reverse().join('')).join('\n');
    }

    nlCommand(args) {
        if (!args[0]) return 'nl: missing operand';
        const content = this.readFile(args[0]);
        return content.split('\n').map((l, i) => `     ${i + 1}\t${l}`).join('\n');
    }

    statCommand(args) {
        if (!args[0]) return 'stat: missing operand';
        const path = this.resolvePath(args[0]);
        const node = this.getNode(path);
        if (!node) return `stat: cannot stat '${args[0]}': No such file or directory`;
        const type = node.type === 'directory' ? 'directory' : 'regular file';
        const size = node.content ? node.content.length : 4096;
        return `  File: ${args[0]}\n  Size: ${size}        Blocks: 8          ${type}\nDevice: 801h/2049d    Inode: 1234567     Links: 1\nAccess: (0755/drwxr-xr-x)  Uid: (1000/    user)   Gid: (1000/    user)\nAccess: 2024-01-01 12:00:00\nModify: 2024-01-01 12:00:00\nChange: 2024-01-01 12:00:00`;
    }

    calCommand(args) {
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        let cal = `    ${monthNames[month]} ${year}\nSu Mo Tu We Th Fr Sa\n`;
        let week = '';
        for (let i = 0; i < firstDay; i++) week += '   ';
        for (let d = 1; d <= daysInMonth; d++) {
            week += String(d).padStart(2) + ' ';
            if ((firstDay + d) % 7 === 0) { cal += week + '\n'; week = ''; }
        }
        if (week) cal += week;
        return cal.trim();
    }

    seqCommand(args) {
        if (args.length === 0) return 'seq: missing operand';
        if (args.length === 1) return Array.from({ length: parseInt(args[0]) }, (_, i) => i + 1).join('\n');
        if (args.length === 2) return Array.from({ length: parseInt(args[1]) - parseInt(args[0]) + 1 }, (_, i) => i + parseInt(args[0])).join('\n');
        return '';
    }

    fileCommand(args) {
        if (!args[0]) return 'file: missing operand';
        const path = this.resolvePath(args[0]);
        const node = this.getNode(path);
        if (!node) return `file: ${args[0]}: No such file or directory`;
        if (node.type === 'directory') return `${args[0]}: directory`;
        return `${args[0]}: ASCII text`;
    }

    treeCommand(args) {
        const path = args.find(a => !a.startsWith('-')) || '.';
        const node = this.getNode(this.resolvePath(path));
        if (!node) return `tree: ${path}: No such file or directory`;
        const buildTree = (name, n, prefix) => {
            if (n.type === 'file') return `${prefix}${name}`;
            let result = `${prefix}${name}/`;
            const children = Object.keys(n.children).sort();
            children.forEach((childName, i) => {
                const isLast = i === children.length - 1;
                const newPrefix = prefix + (isLast ? '    ' : '│   ');
                result += '\n' + buildTree(childName, n.children[childName], newPrefix);
            });
            return result;
        };
        return buildTree(path, node, '');
    }

    md5sumCommand(args) {
        if (!args[0]) return 'md5sum: missing operand';
        const node = this.getNode(this.resolvePath(args[0]));
        if (!node) return `md5sum: ${args[0]}: No such file or directory`;
        const content = node.content || '';
        let hash = 0;
        for (let i = 0; i < content.length; i++) { hash = ((hash << 5) - hash) + content.charCodeAt(i); hash |= 0; }
        const hex = Math.abs(hash).toString(16).padStart(8, '0');
        return `d41d8cd98f00b204e9800998ecf8427e  ${args[0]}`;
    }

    base64Command(args) {
        if (args.includes('-d')) {
            const encoded = args.find(a => !a.startsWith('-') && a !== '-d');
            try { return atob(encoded); } catch { return 'base64: invalid input'; }
        }
        const text = args.find(a => !a.startsWith('-'));
        if (!text) return 'base64: missing operand';
        try { return btoa(text); } catch { return 'base64: encoding error'; }
    }

    stringsCommand(args) {
        if (!args[0]) return 'strings: missing operand';
        const content = this.readFile(args[0]);
        return content.split('\n').filter(l => l.length > 3).join('\n');
    }

    wgetCommand(args) {
        const url = args.find(a => !a.startsWith('-'));
        if (!url) return 'wget: missing URL\nUsage: wget [URL]';
        return `--${new Date().toLocaleTimeString()}--  ${url}\nResolving host... 127.0.0.1\nConnecting to ${url}|127.0.0.1|:80... connected.\nHTTP request sent, awaiting response... 200 OK\nLength: 1234 (1.2K) [text/html]\nSaving to: 'index.html'\n\nindex.html  100%[===============>]   1.20K  --.-KB/s    in 0.001s\n\n${new Date().toLocaleTimeString()} (1.20 MB/s) - 'index.html' saved [1234/1234]`;
    }

    curlCommand(args) {
        const url = args.find(a => !a.startsWith('-'));
        if (!url) return 'curl: try \'curl [URL]\'';
        if (args.includes('-I')) return `HTTP/1.1 200 OK\nServer: nginx/1.18.0\nDate: ${new Date().toUTCString()}\nContent-Type: text/html\nContent-Length: 1234`;
        return `<!DOCTYPE html>\n<html><head><title>${url}</title></head>\n<body><h1>Welcome to ${url}</h1></body></html>`;
    }

    systemctlCommand(args) {
        if (!args[0]) return 'systemctl: missing operand';
        const action = args[0];
        const service = args[1] || 'service';
        if (action === 'status') return `● ${service}.service - ${service} daemon\n     Loaded: loaded (/lib/systemd/system/${service}.service; enabled)\n     Active: active (running) since ${new Date().toISOString()}\n   Main PID: 1234 (${service})\n      Tasks: 1\n     Memory: 2.4M\n        CPU: 100ms`;
        if (action === 'start') return '';
        if (action === 'stop') return '';
        if (action === 'restart') return '';
        if (action === 'list-units') return `  UNIT                         LOAD   ACTIVE SUB     DESCRIPTION\n  ssh.service                  loaded active running OpenSSH server\n  nginx.service                loaded active running nginx web server\n  docker.service               loaded active running Docker daemon\n\n3 loaded units listed.`;
        return `systemctl: unknown action '${action}'`;
    }

    neofetchCommand() {
        return `       _____         user@linux-arsenal\n      /     \\        ----------------\n     | () () |       OS: Linux Arsenal 1.0 x86_64\n      \\  ^  /        Host: Virtual Machine\n       |||||         Kernel: 5.4.0-74-generic\n       |||||         Uptime: 3 hours, 42 mins\n                     Packages: 1234 (apt)\n                     Shell: bash 5.1\n                     Resolution: 1920x1080\n                     Terminal: Linux Arsenal\n                     CPU: Intel i5-8250U (4) @ 1.60GHz\n                     GPU: Virtual Graphics\n                     Memory: 1228MiB / 3900MiB\n                     Disk: 18G / 50G (38%)\n                     IP: 192.168.1.100`;
    }

    cowsayCommand(args) {
        const message = args.join(' ') || 'Moo!';
        const top = ' ' + '_'.repeat(message.length + 2);
        const bottom = ' ' + '-'.repeat(message.length + 2);
        return `${top}\n< ${message} >\n${bottom}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`;
    }

    figletCommand(args) {
        const text = (args.join(' ') || 'Hello').toUpperCase();
        return text.split('').map(c => {
            const chars = {
                'A': '  ___  \n / _ \\ \n| |_| |\n|  _  |\n| | | |\n|_| |_|', 'B': ' ___  \n| _ ) \n| _ \\ \n|___/ \n|_|   ', 'H': ' _   _ \n| | | |\n| |_| |\n|  _  |\n|_| |_|', 'L': ' _    \n| |   \n| |   \n| |___\n|_____|\n      ', 'O': '  ___  \n / _ \\ \n| |_| |\n| | | |\n| |_| |\n \\___/ ', 'E': ' _____ \n| ____|\n|  _|\n |___| \n|_____|\n       ', 'W': '__        __\n\\ \\      / /\n \\ \\ /\\ / / \n  \\ V  V /  \n   \\_/\\_/   \n            '
            };
            return chars[c] || `  ##  \n #### \n  ##  `;
        }).join('\n');
    }

    // Terminal window management
    minimizeTerminal() {
        const terminalContainer = document.querySelector('.terminal-container');
        if (terminalContainer) terminalContainer.classList.add('minimized');
        const minimizedBar = document.getElementById('minimized-terminal');
        if (minimizedBar) minimizedBar.classList.remove('hidden');
        const preview = document.getElementById('minimized-preview');
        if (preview) {
            const lastCmd = this.commandHistory[this.commandHistory.length - 1];
            preview.textContent = lastCmd ? `$ ${lastCmd}` : 'Terminal ready - click to restore';
        }
    }

    restoreTerminal() {
        const terminalContainer = document.querySelector('.terminal-container');
        if (terminalContainer) terminalContainer.classList.remove('minimized');
        const minimizedBar = document.getElementById('minimized-terminal');
        if (minimizedBar) minimizedBar.classList.add('hidden');
        setTimeout(() => document.getElementById('terminal-input').focus(), 100);
    }

    toggleFullscreen() {
        const terminalContainer = document.querySelector('.terminal-container');
        if (!terminalContainer) return;
        terminalContainer.classList.toggle('terminal-fullscreen');
    }

    minimizeAIAssistant() {
        const assistant = document.getElementById('ai-assistant');
        if (!assistant) return;
        if (assistant.classList.contains('minimized')) {
            assistant.classList.remove('minimized');
        } else {
            assistant.classList.add('minimized');
        }
    }

    // Command tracking and progress
    trackCommandUsage(command, success) {
        if (!this.uniqueCommands) this.uniqueCommands = new Set();
        this.uniqueCommands.add(command);
        this.user.commandsLearned = this.uniqueCommands.size;
        if (success) {
            this.user.xp += 10;
            const newLevel = Math.floor(this.user.xp / 150) + 1;
            if (newLevel > this.user.level) {
                this.user.level = newLevel;
                this.showNotification(`Level Up! You are now level ${newLevel}!`, 'success');
            }
            this.updateUserDisplay();
        }
    }

    updateUserProgress(command, success) {
        if (success) { this.user.timeSpent += 1; }
        this.saveUserData();
    }

    // Challenge system
    generateChallenges() {
        const templates = [
            { id: 'begin_0', title: 'List Directory Contents', description: "Use 'ls' to list files in the current directory.", difficulty: 'beginner', category: 'File Operations', xp: 25, solution: 'ls', hints: ["Type 'ls' and press Enter"], completed: false },
            { id: 'begin_1', title: 'Navigate to Home', description: "Use 'cd ~' to go to your home directory.", difficulty: 'beginner', category: 'File Operations', xp: 25, solution: ['cd ~', 'cd'], hints: ["Use cd with ~ for home"], completed: false },
            { id: 'begin_2', title: 'Create a Directory', description: "Create a directory named 'test'.", difficulty: 'beginner', category: 'File Operations', xp: 30, solution: 'mkdir test', hints: ["Use mkdir command"], completed: false },
            { id: 'begin_3', title: 'Find Your Location', description: "Display your current working directory path.", difficulty: 'beginner', category: 'File Operations', xp: 20, solution: 'pwd', hints: ["Use pwd command"], completed: false },
            { id: 'begin_4', title: 'Display File Contents', description: "Show contents of documents/readme.txt using cat.", difficulty: 'beginner', category: 'Text Processing', xp: 35, solution: ['cat documents/readme.txt', 'cat ~/documents/readme.txt'], hints: ["Use cat with the file path"], completed: false },
            { id: 'begin_5', title: 'Create Empty File', description: "Create a file named 'newfile.txt' with touch.", difficulty: 'beginner', category: 'File Operations', xp: 25, solution: 'touch newfile.txt', hints: ["Use touch command"], completed: false },
            { id: 'begin_6', title: 'Show Current User', description: "Display the current username.", difficulty: 'beginner', category: 'System Administration', xp: 20, solution: 'whoami', hints: ["Use whoami command"], completed: false },
            { id: 'begin_7', title: 'Show Date and Time', description: "Display the current system date and time.", difficulty: 'beginner', category: 'System Administration', xp: 20, solution: 'date', hints: ["Use date command"], completed: false },
            { id: 'begin_8', title: 'System Information', description: "Display system information using uname.", difficulty: 'beginner', category: 'System Administration', xp: 25, solution: ['uname', 'uname -a'], hints: ["Use uname command"], completed: false },
            { id: 'begin_9', title: 'Echo Text', description: "Display 'Hello World' using echo.", difficulty: 'beginner', category: 'Text Processing', xp: 15, solution: 'echo Hello World', hints: ["Use echo command"], completed: false },
            { id: 'int_0', title: 'Search for Pattern', description: "Use grep to find 'user' in /etc/passwd.", difficulty: 'intermediate', category: 'Text Processing', xp: 50, solution: 'grep user /etc/passwd', hints: ["grep [pattern] [file]"], completed: false },
            { id: 'int_1', title: 'Sort File Contents', description: "Sort /etc/passwd alphabetically.", difficulty: 'intermediate', category: 'Text Processing', xp: 45, solution: 'sort /etc/passwd', hints: ["Use sort command"], completed: false },
            { id: 'int_2', title: 'Count Words', description: "Count lines, words, and chars in documents/readme.txt.", difficulty: 'intermediate', category: 'Text Processing', xp: 40, solution: ['wc documents/readme.txt', 'wc ~/documents/readme.txt'], hints: ["Use wc command"], completed: false },
            { id: 'int_3', title: 'Process List', description: "Show all running processes with ps aux.", difficulty: 'intermediate', category: 'System Administration', xp: 55, solution: 'ps aux', hints: ["Use ps with aux flags"], completed: false },
            { id: 'int_4', title: 'Disk Usage', description: "Check disk usage in human-readable format.", difficulty: 'intermediate', category: 'System Administration', xp: 50, solution: ['du -h', 'df -h'], hints: ["Use du or df with -h flag"], completed: false },
            { id: 'int_5', title: 'Free Memory', description: "Display memory usage in human-readable format.", difficulty: 'intermediate', category: 'System Administration', xp: 45, solution: 'free -h', hints: ["Use free with -h flag"], completed: false },
            { id: 'int_6', title: 'Network Ping', description: "Ping google.com with 3 packets.", difficulty: 'intermediate', category: 'Networking', xp: 50, solution: 'ping -c 3 google.com', hints: ["Use ping with -c flag"], completed: false },
            { id: 'adv_0', title: 'File Permissions', description: "Change file permissions to 644.", difficulty: 'advanced', category: 'Security', xp: 80, solution: 'chmod 644 filename', hints: ["Use chmod with numeric mode"], completed: false },
            { id: 'adv_1', title: 'Create Archive', description: "Create a tar.gz archive of documents.", difficulty: 'advanced', category: 'File Operations', xp: 90, solution: 'tar -czf docs.tar.gz documents', hints: ["Use tar with -czf flags"], completed: false },
            { id: 'adv_2', title: 'Symbolic Link', description: "Create a symbolic link to documents.", difficulty: 'advanced', category: 'File Operations', xp: 70, solution: 'ln -s documents shortcut', hints: ["Use ln with -s flag"], completed: false }
        ];
        this.challenges = templates;
    }

    loadChallenges() {
        const grid = document.getElementById('challenges-grid');
        if (!grid) return;
        const display = this.challenges.slice(0, 50);
        grid.innerHTML = display.map(ch => `
            <div class="challenge-card ${ch.completed ? 'completed' : ''}" data-challenge-id="${ch.id}">
                <div class="challenge-header">
                    <div class="challenge-title">${this.escapeHtml(ch.title)}</div>
                    <div class="challenge-difficulty difficulty-${ch.difficulty}">${ch.difficulty}</div>
                </div>
                <div class="challenge-description">${this.escapeHtml(ch.description)}</div>
                <div class="challenge-meta">
                    <div class="challenge-category">${this.escapeHtml(ch.category)}</div>
                    <div class="challenge-xp">+${ch.xp} XP</div>
                </div>
            </div>
        `).join('');
        grid.querySelectorAll('.challenge-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.openChallenge(e.currentTarget.dataset.challengeId);
            });
        });
        this.updateChallengeStats();
    }

    updateChallengeStats() {
        const total = this.challenges.length;
        const completed = this.challenges.filter(c => c.completed).length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const tEl = document.getElementById('total-challenges');
        const cEl = document.getElementById('completed-challenges');
        const sEl = document.getElementById('success-rate');
        if (tEl) tEl.textContent = total;
        if (cEl) cEl.textContent = completed;
        if (sEl) sEl.textContent = rate + '%';
    }

    filterChallenges(filter) {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        const btn = document.querySelector(`[data-filter="${filter}"]`);
        if (btn) btn.classList.add('active');
        document.querySelectorAll('.challenge-card').forEach(card => {
            const ch = this.challenges.find(c => c.id === card.dataset.challengeId);
            if (filter === 'all' || (ch && ch.difficulty === filter)) card.style.display = 'block';
            else card.style.display = 'none';
        });
    }

    searchChallenges(term) {
        const t = term.toLowerCase();
        document.querySelectorAll('.challenge-card').forEach(card => {
            const ch = this.challenges.find(c => c.id === card.dataset.challengeId);
            const match = !t || (ch && (ch.title.toLowerCase().includes(t) || ch.description.toLowerCase().includes(t) || ch.category.toLowerCase().includes(t)));
            card.style.display = match ? 'block' : 'none';
        });
    }

    generateRandomChallenge() {
        const diffs = ['beginner', 'intermediate', 'advanced'];
        const cats = ['File Operations', 'Text Processing', 'System Administration', 'Networking', 'Security'];
        const diff = diffs[Math.floor(Math.random() * diffs.length)];
        const cat = cats[Math.floor(Math.random() * cats.length)];
        this.challenges.unshift({
            id: `random_${Date.now()}`,
            title: `Random ${cat} Challenge`,
            description: `Complete a ${diff} level ${cat.toLowerCase()} task.`,
            difficulty: diff, category: cat,
            xp: 25 + Math.floor(Math.random() * 75),
            solution: 'echo "Challenge completed"',
            hints: [`Focus on ${cat.toLowerCase()} commands`],
            completed: false
        });
        this.loadChallenges();
        this.showNotification('New challenge generated!', 'success');
    }

    loadMoreChallenges() {
        this.showNotification('All challenges are already loaded', 'info');
    }

    openChallenge(challengeId) {
        const ch = this.challenges.find(c => c.id === challengeId);
        if (!ch) return;
        this.currentChallenge = ch;
        this.challengeAttempts = 0;
        document.getElementById('challenge-title').textContent = ch.title;
        document.getElementById('challenge-description').innerHTML = `
            <p><strong>Task:</strong> ${this.escapeHtml(ch.description)}</p>
            <p><strong>Category:</strong> ${this.escapeHtml(ch.category)}</p>
            <p><strong>Difficulty:</strong> ${ch.difficulty}</p>
            <p><strong>Reward:</strong> +${ch.xp} XP</p>
        `;
        const attemptsEl = document.getElementById('challenge-attempts');
        if (attemptsEl) attemptsEl.textContent = 'Attempts: 0';
        const output = document.getElementById('challenge-output');
        if (output) output.innerHTML = '<div class="welcome-message">Challenge Terminal - Enter your solution below:</div>';
        const hintDisplay = document.getElementById('hint-display');
        if (hintDisplay) { hintDisplay.classList.add('hidden'); hintDisplay.textContent = ''; }
        document.getElementById('challenge-modal').classList.remove('hidden');
        const input = document.getElementById('challenge-input');
        if (input) { input.value = ''; input.focus(); input.onkeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); const v = e.target.value.trim(); if (v) { this.processChallengeCommand(v); e.target.value = ''; } }
        }; }
    }

    showChallengeHint() {
        if (!this.currentChallenge) return;
        const hd = document.getElementById('hint-display');
        if (!hd) return;
        const hints = this.currentChallenge.hints || ['No hints available'];
        const idx = Math.min(this.challengeAttempts, hints.length - 1);
        hd.textContent = hints[Math.max(0, idx)];
        hd.classList.remove('hidden');
    }

    processChallengeCommand(command) {
        if (!this.currentChallenge) return;
        const output = document.getElementById('challenge-output');
        if (!output) return;
        this.challengeAttempts++;
        const attemptsEl = document.getElementById('challenge-attempts');
        if (attemptsEl) attemptsEl.textContent = `Attempts: ${this.challengeAttempts}`;
        const cmdDiv = document.createElement('div');
        cmdDiv.innerHTML = `<span class="command-prompt">user@challenge:~$</span> <span class="command-text">${this.escapeHtml(command)}</span>`;
        output.appendChild(cmdDiv);
        let isCorrect = false;
        try {
            const solution = this.currentChallenge.solution;
            if (Array.isArray(solution)) isCorrect = solution.some(s => command.trim().toLowerCase() === s.toLowerCase());
            else isCorrect = command.trim().toLowerCase() === solution.toLowerCase();
            if (!isCorrect) {
                const firstCmd = Array.isArray(solution) ? solution[0].split(' ')[0] : solution.split(' ')[0];
                if (command.trim().toLowerCase().startsWith(firstCmd.toLowerCase())) isCorrect = true;
            }
        } catch (e) { isCorrect = false; }
        if (isCorrect) {
            const successDiv = document.createElement('div');
            successDiv.className = 'command-success';
            successDiv.innerHTML = `<div style="color:#00ff88;font-weight:bold;margin:10px 0;">Challenge completed! +${this.currentChallenge.xp} XP</div>`;
            output.appendChild(successDiv);
            this.completeChallenge(this.currentChallenge.id);
            setTimeout(() => this.closeChallenge(), 3000);
        } else {
            const hintDiv = document.createElement('div');
            hintDiv.className = 'command-error';
            const hint = this.currentChallenge.hints ? this.currentChallenge.hints[Math.floor(Math.random() * this.currentChallenge.hints.length)] : 'Try again!';
            hintDiv.innerHTML = `<div style="color:#ff6b6b;margin:10px 0;">Try again!</div><div style="color:#ffa726;font-size:14px;"><strong>Hint:</strong> ${this.escapeHtml(hint)}</div>`;
            output.appendChild(hintDiv);
        }
        output.scrollTop = output.scrollHeight;
    }

    completeChallenge(challengeId) {
        const ch = this.challenges.find(c => c.id === challengeId);
        if (ch && !ch.completed) {
            ch.completed = true;
            this.user.xp += ch.xp;
            const newLevel = Math.floor(this.user.xp / 150) + 1;
            if (newLevel > this.user.level) { this.user.level = newLevel; this.showNotification(`Level Up! You are now level ${newLevel}!`, 'success'); }
            const card = document.querySelector(`[data-challenge-id="${challengeId}"]`);
            if (card) card.classList.add('completed');
            this.updateUserDisplay();
            this.updateChallengeStats();
            this.saveUserData();
            this.showNotification(`Challenge completed! +${ch.xp} XP`, 'success');
        }
    }

    closeChallenge() {
        document.getElementById('challenge-modal').classList.add('hidden');
        this.currentChallenge = null;
        this.challengeAttempts = 0;
    }

    // Achievements
    initializeAchievements() {
        this.achievementDefinitions = [
            { id: 'first_command', name: 'First Steps', description: 'Execute your first command', icon: 'fas fa-shoe-prints', condition: () => this.commandHistory.length >= 1 },
            { id: 'explorer', name: 'Explorer', description: 'Use cd 5 times', icon: 'fas fa-compass', condition: () => this.commandHistory.filter(c => c.startsWith('cd')).length >= 5 },
            { id: 'command_master', name: 'Command Master', description: 'Learn 10 different commands', icon: 'fas fa-graduation-cap', condition: () => (this.uniqueCommands && this.uniqueCommands.size >= 10) },
            { id: 'challenge_starter', name: 'Challenge Starter', description: 'Complete 3 challenges', icon: 'fas fa-play', condition: () => this.challenges.filter(c => c.completed).length >= 3 },
            { id: 'xp_hunter', name: 'XP Hunter', description: 'Earn 500 XP', icon: 'fas fa-coins', condition: () => this.user.xp >= 500 },
            { id: 'level_5', name: 'Level 5 Hero', description: 'Reach level 5', icon: 'fas fa-trophy', condition: () => this.user.level >= 5 },
            { id: 'streak_3', name: 'Three Day Streak', description: '3-day learning streak', icon: 'fas fa-fire', condition: () => this.user.streak >= 3 }
        ];
    }

    checkAchievements() {
        if (!this.achievementDefinitions) return;
        this.achievementDefinitions.forEach(a => {
            if (!this.achievements.includes(a.id) && a.condition()) this.unlockAchievement(a.id);
        });
    }

    unlockAchievement(id) {
        this.achievements.push(id);
        const a = this.achievementDefinitions.find(d => d.id === id);
        if (a) { this.showNotification(`Achievement Unlocked: ${a.name}!`, 'success'); this.user.xp += 50; this.updateUserDisplay(); }
    }

    loadAchievements() {
        const grid = document.getElementById('achievements-grid');
        if (!grid || !this.achievementDefinitions) return;
        grid.innerHTML = this.achievementDefinitions.map(a => {
            const unlocked = this.achievements.includes(a.id);
            return `<div class="achievement-card ${unlocked ? 'unlocked' : ''}"><div class="achievement-icon"><i class="${a.icon}"></i></div><div class="achievement-name">${this.escapeHtml(a.name)}</div><div class="achievement-description">${this.escapeHtml(a.description)}</div></div>`;
        }).join('');
        const uEl = document.getElementById('unlocked-count');
        const tEl = document.getElementById('total-achievements');
        if (uEl) uEl.textContent = this.achievements.length;
        if (tEl) tEl.textContent = this.achievementDefinitions.length;
    }

    // Leaderboard
    updateLeaderboard() {
        const mockUsers = [
            { name: 'LinuxNinja', level: 15, xp: 2450, streak: 21, challenges: 42 },
            { name: 'TerminalMaster', level: 12, xp: 1890, streak: 15, challenges: 28 },
            { name: 'CommandGuru', level: 11, xp: 1654, streak: 8, challenges: 22 },
            { name: 'BashExpert', level: 10, xp: 1543, streak: 12, challenges: 19 },
            { name: 'ShellWizard', level: 9, xp: 1321, streak: 6, challenges: 15 },
            { name: 'CodeWarrior', level: 8, xp: 1120, streak: 10, challenges: 12 },
            { name: 'You', level: this.user.level, xp: this.user.xp, streak: this.user.streak, challenges: this.challenges.filter(c => c.completed).length }
        ];
        mockUsers.sort((a, b) => b.xp - a.xp);
        const list = document.getElementById('leaderboard-list');
        if (!list) return;
        list.innerHTML = mockUsers.map((u, i) => `
            <div class="leaderboard-entry ${u.name === 'You' ? 'current-user' : ''}">
                <div class="entry-rank ${i < 3 ? 'top-3' : ''}">#${i + 1}</div>
                <div class="entry-user">${this.escapeHtml(u.name)}</div>
                <div class="entry-level">${u.level}</div>
                <div class="entry-xp">${u.xp}</div>
                <div class="entry-streak">${u.streak}</div>
                <div class="entry-challenges">${u.challenges}</div>
            </div>
        `).join('');
    }

    // AI Assistant
    toggleAIAssistant() {
        const assistant = document.getElementById('ai-assistant');
        if (!assistant) return;
        this.aiAssistantOpen = !this.aiAssistantOpen;
        if (this.aiAssistantOpen) {
            assistant.classList.remove('collapsed');
        } else {
            assistant.classList.add('collapsed');
        }
    }

    sendAIMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        if (!message) return;
        this.addChatMessage(message, 'user');
        input.value = '';
        setTimeout(() => {
            const response = this.generateAIResponse(message);
            this.addChatMessage(response, 'assistant');
        }, 800);
    }

    addChatMessage(message, sender) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;
        const messageDiv = document.createElement('div');
        messageDiv.className = `${sender}-message`;
        const avatar = sender === 'assistant' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message;
        messageDiv.innerHTML = `<div class="message-avatar">${avatar}</div>`;
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    generateAIResponse(message) {
        const m = message.toLowerCase();

        // Command-specific help
        const commandHelp = {
            ls: "The 'ls' command lists directory contents.\n\nOptions:\n- ls -l (detailed list with permissions)\n- ls -a (show hidden files)\n- ls -la (both combined)\n- ls -R (recursive listing)\n- ls -lh (human-readable sizes)\n\nExample: ls -la /home",
            cd: "The 'cd' command changes directories.\n\nUsage:\n- cd ~ (go home)\n- cd .. (go up one level)\n- cd /path/to/dir (absolute path)\n- cd documents (relative path)\n- cd - (go to previous directory)\n\nTip: Use Tab to auto-complete paths!",
            pwd: "The 'pwd' command prints your current working directory.\n\nUsage: pwd\n\nIt shows the full path like /home/user/documents.",
            cat: "The 'cat' command displays file contents.\n\nUsage: cat [filename]\n\nExamples:\n- cat readme.txt (show file)\n- cat file1 file2 (show multiple files)\n- cat -n file.txt (show with line numbers)\n\nTip: Use 'cat > file.txt' to write content, Ctrl+D to save.",
            mkdir: "The 'mkdir' command creates directories.\n\nUsage: mkdir [dirname]\n\nOptions:\n- mkdir -p path/to/nested/dir (create parent dirs)\n- mkdir dir1 dir2 (create multiple)\n\nExample: mkdir -p project/src/components",
            touch: "The 'touch' command creates empty files or updates timestamps.\n\nUsage: touch [filename]\n\nExample: touch newfile.txt\n\nYou can create multiple: touch file1.txt file2.txt",
            rm: "The 'rm' command removes files or directories.\n\nUsage: rm [filename]\n\nOptions:\n- rm -r dirname (remove directory recursively)\n- rm -f file (force, no confirmation)\n- rm -rf dirname (force recursive)\n\nWARNING: rm is permanent! Be careful with -rf.",
            cp: "The 'cp' command copies files or directories.\n\nUsage: cp [source] [destination]\n\nOptions:\n- cp -r dir1 dir2 (copy directory recursively)\n- cp -i file dest (prompt before overwrite)\n- cp -v file dest (verbose output)\n\nExample: cp -r documents backup",
            mv: "The 'mv' command moves or renames files.\n\nUsage: mv [source] [destination]\n\nExamples:\n- mv oldname.txt newname.txt (rename)\n- mv file.txt /tmp/ (move to /tmp)\n- mv -i file dest (prompt before overwrite)",
            grep: "The 'grep' command searches for text patterns.\n\nUsage: grep [pattern] [file]\n\nOptions:\n- grep -i (case insensitive)\n- grep -n (show line numbers)\n- grep -r (recursive search)\n- grep -c (count matches)\n- grep -v (invert - non-matching lines)\n\nExamples:\n- grep -i 'error' log.txt\n- grep -rn 'function' /src/",
            find: "The 'find' command searches for files and directories.\n\nUsage: find [path] [options]\n\nOptions:\n- -name '*.txt' (search by name)\n- -type f (files only)\n- -type d (directories only)\n- -mtime -7 (modified in last 7 days)\n- -size +1M (larger than 1MB)\n\nExample: find /home -name '*.log' -mtime -1",
            chmod: "The 'chmod' command changes file permissions.\n\nNumeric mode:\n- 755 = rwxr-xr-x (owner full, others read/execute)\n- 644 = rw-r--r-- (owner read/write, others read)\n- 600 = rw------- (owner only)\n- 777 = rwxrwxrwx (everyone full)\n\nSymbolic mode:\n- u+x (add execute for user)\n- g-w (remove write for group)\n- o=r (set read for others)\n\nExample: chmod 755 script.sh",
            chown: "The 'chown' command changes file ownership.\n\nUsage: chown [owner][:group] [file]\n\nExamples:\n- chown user file.txt (change owner)\n- chown user:group file.txt (change owner and group)\n- chown -R user dir/ (recursive)",
            ln: "The 'ln' command creates links between files.\n\nUsage:\n- ln -s [target] [linkname] (symbolic link)\n- ln [target] [linkname] (hard link)\n\nSymbolic links are like shortcuts. Hard links point to the same data.\n\nExample: ln -s /var/log logs",
            tar: "The 'tar' command creates and extracts archives.\n\nUsage:\n- tar -czf archive.tar.gz files/ (create gzip)\n- tar -xzf archive.tar.gz (extract gzip)\n- tar -tf archive.tar.gz (list contents)\n- tar -cjf archive.tar.bz2 files/ (create bzip2)\n\nOptions: -c (create), -x (extract), -t (list), -z (gzip), -j (bzip2), -f (file)",
            ps: "The 'ps' command shows running processes.\n\nUsage:\n- ps aux (all processes, BSD style)\n- ps -ef (all processes, System V style)\n- ps -u user (processes by user)\n\nCommon with grep: ps aux | grep nginx",
            kill: "The 'kill' command sends signals to processes.\n\nUsage: kill [PID]\n\nSignals:\n- kill PID (SIGTERM - graceful)\n- kill -9 PID (SIGKILL - force)\n- kill -15 PID (SIGTERM explicit)\n\nFind PID with: ps aux | grep processname",
            ping: "The 'ping' command tests network connectivity.\n\nUsage: ping [hostname]\n\nOptions:\n- ping -c 4 google.com (4 packets)\n- ping -i 2 host (2 sec interval)\n- ping -W 5 host (5 sec timeout)\n\nPress Ctrl+C to stop continuous ping.",
            netstat: "The 'netstat' command shows network connections.\n\nUsage:\n- netstat -tuln (listening ports)\n- netstat -a (all connections)\n- netstat -r (routing table)\n- netstat -i (interface stats)\n\nCommon: netstat -tulnp (with process info)",
            ifconfig: "The 'ifconfig' command displays network interface configuration.\n\nUsage: ifconfig [interface]\n\nShows IP address, MAC, packet stats.\nNote: Modern systems use 'ip addr' instead.",
            du: "The 'du' command shows disk usage.\n\nUsage: du [options] [path]\n\nOptions:\n- du -h (human-readable: K, M, G)\n- du -s (summary only)\n- du -sh * (size of each item)\n- du --max-depth=1 (one level deep)",
            df: "The 'df' command shows filesystem disk space.\n\nUsage: df [options]\n\nOptions:\n- df -h (human-readable)\n- df -T (show filesystem type)\n- df -i (inode usage)\n\nShows total, used, available, and mount points.",
            free: "The 'free' command shows memory usage.\n\nUsage: free [options]\n\nOptions:\n- free -h (human-readable)\n- free -m (megabytes)\n- free -g (gigabytes)\n- free -s 5 (update every 5 sec)\n\nShows total, used, free, shared, buffer/cache, available.",
            top: "The 'top' command shows real-time process activity.\n\nUsage: top\n\nInteractive keys:\n- P (sort by CPU)\n- M (sort by memory)\n- k (kill process)\n- q (quit)\n- 1 (show per-CPU stats)\n\nSimilar tools: htop, btop, glances",
            uptime: "The 'uptime' command shows system uptime and load.\n\nUsage: uptime\n\nShows: current time, uptime duration, users logged in, load averages (1, 5, 15 min).",
            env: "The 'env' command shows or sets environment variables.\n\nUsage:\n- env (show all variables)\n- env VAR=value command (set for one command)\n- export VAR=value (set permanently)\n\nCommon variables: PATH, HOME, USER, SHELL, TERM, DISPLAY",
            export: "The 'export' command sets environment variables.\n\nUsage: export VARIABLE=value\n\nExamples:\n- export PATH=$PATH:/new/path\n- export EDITOR=vim\n- export JAVA_HOME=/usr/lib/jvm/java-11",
            alias: "The 'alias' command creates command shortcuts.\n\nUsage: alias name='command'\n\nExamples:\n- alias ll='ls -la'\n- alias gs='git status'\n- alias ..='cd ..'\n\nAdd to ~/.bashrc to make permanent.",
            diff: "The 'diff' command compares files line by line.\n\nUsage: diff [file1] [file2]\n\nOptions:\n- diff -u (unified format)\n- diff -r (recursive for directories)\n- diff -i (ignore case)\n- diff --color (colored output)",
            tee: "The 'tee' command reads stdin and writes to stdout and files.\n\nUsage: command | tee [file]\n\nOptions:\n- tee -a file (append instead of overwrite)\n\nExample: ls -la | tee output.txt (shows and saves)",
            tr: "The 'tr' command translates or deletes characters.\n\nUsage: echo text | tr [SET1] [SET2]\n\nExamples:\n- echo 'hello' | tr 'a-z' 'A-Z' (uppercase)\n- echo 'hello' | tr -d 'l' (delete l's)\n- echo 'a,b,c' | tr ',' '\\n' (comma to newline)",
            cut: "The 'cut' command extracts sections from lines.\n\nUsage: cut [options] [file]\n\nOptions:\n- cut -d',' -f1 (delimiter and field)\n- cut -c1-5 (characters 1-5)\n- cut -b1-10 (bytes 1-10)\n\nExample: cut -d: -f1 /etc/passwd (show usernames)",
            uniq: "The 'uniq' command filters out adjacent duplicate lines.\n\nUsage: uniq [file]\n\nOptions:\n- uniq -c (count occurrences)\n- uniq -d (show only duplicates)\n- uniq -u (show only unique)\n\nTip: Sort first: sort file | uniq -c",
            sort: "The 'sort' command sorts lines of text.\n\nUsage: sort [file]\n\nOptions:\n- sort -r (reverse)\n- sort -n (numeric)\n- sort -u (unique, remove dups)\n- sort -k2 (by second field)\n- sort -t',' -k2 (by second CSV field)",
            head: "The 'head' command shows the first lines of a file.\n\nUsage: head [file]\n\nOptions:\n- head -n 20 file (first 20 lines)\n- head -c 100 file (first 100 bytes)\n- head -5 file (first 5 lines)\n\nOpposite: tail (shows last lines)",
            tail: "The 'tail' command shows the last lines of a file.\n\nUsage: tail [file]\n\nOptions:\n- tail -n 20 file (last 20 lines)\n- tail -f file (follow in real-time)\n- tail -f /var/log/syslog (live log monitoring)\n\nGreat for watching log files!",
            wc: "The 'wc' command counts lines, words, and characters.\n\nUsage: wc [file]\n\nOptions:\n- wc -l (lines only)\n- wc -w (words only)\n- wc -c (characters/bytes only)\n\nExample: grep 'error' log.txt | wc -l (count errors)",
            echo: "The 'echo' command prints text to the terminal.\n\nUsage: echo [text]\n\nOptions:\n- echo -n (no trailing newline)\n- echo -e (interpret escapes like \\n, \\t)\n\nRedirect: echo 'hello' > file.txt (write to file)\nAppend: echo 'more' >> file.txt",
            whoami: "The 'whoami' command prints the current username.\n\nUsage: whoami\n\nSimilar: id (shows uid, gid, and groups)",
            date: "The 'date' command shows or sets the system date.\n\nUsage: date [options]\n\nFormat: date '+%Y-%m-%d %H:%M:%S'\n- %Y (year), %m (month), %d (day)\n- %H (hour), %M (minute), %S (second)\n\nExample: date '+%A, %B %d, %Y'",
            uname: "The 'uname' command shows system information.\n\nUsage: uname [options]\n\nOptions:\n- uname -a (all info)\n- uname -r (kernel version)\n- uname -m (machine type)\n- uname -o (operating system)",
            history: "The 'history' command shows previously executed commands.\n\nUsage: history\n\nTips:\n- !! (run last command)\n- !n (run command number n)\n- !grep (run last grep command)\n- history -c (clear history)",
            man: "The 'man' command shows manual pages for commands.\n\nUsage: man [command]\n\nNavigation:\n- Arrow keys to scroll\n- / to search\n- q to quit\n\nExample: man ls (complete ls documentation)",
            clear: "The 'clear' command clears the terminal screen.\n\nUsage: clear\n\nShortcut: Ctrl+L does the same thing.",
            neofetch: "The 'neofetch' command shows system info with a logo.\n\nUsage: neofetch\n\nDisplays: OS, kernel, uptime, packages, shell, resolution, CPU, GPU, memory, disk.\n\nCustomize with config file: ~/.config/neofetch/config.conf",
            systemctl: "The 'systemctl' command manages systemd services.\n\nUsage: systemctl [action] [service]\n\nActions:\n- start, stop, restart, reload\n- status (check state)\n- enable (start on boot)\n- disable (don't start on boot)\n- list-units (show all)\n\nExample: systemctl status nginx",
            wget: "The 'wget' command downloads files from the web.\n\nUsage: wget [URL]\n\nOptions:\n- wget -O filename URL (save as)\n- wget -c URL (continue/resume)\n- wget -q URL (quiet mode)\n- wget -r URL (recursive/mirror)",
            curl: "The 'curl' command transfers data from URLs.\n\nUsage: curl [URL]\n\nOptions:\n- curl -O URL (save with original name)\n- curl -I URL (headers only)\n- curl -d 'data' URL (POST data)\n- curl -H 'Content-Type: application/json' URL",
            ssh: "The 'ssh' command connects to remote machines.\n\nUsage: ssh [user]@[host]\n\nOptions:\n- ssh -p 2222 user@host (custom port)\n- ssh -i key.pem user@host (use key file)\n- ssh user@host 'command' (run remote command)\n\nExample: ssh user@192.168.1.10",
            cal: "The 'cal' command displays a calendar.\n\nUsage: cal [month] [year]\n\nExamples:\n- cal (current month)\n- cal 2024 (full year)\n- cal march 2024 (specific month)",
            seq: "The 'seq' command prints a sequence of numbers.\n\nUsage: seq [start] [end] or seq [start] [increment] [end]\n\nExamples:\n- seq 5 (1 to 5)\n- seq 2 10 (2 to 10)\n- seq 1 2 10 (1,3,5,7,9 - step 2)\n- seq -f '%03g' 5 (001, 002, 003, 004, 005)",
            stat: "The 'stat' command shows file or filesystem status.\n\nUsage: stat [file]\n\nShows: size, blocks, inode, links, permissions, owner, group, access/modify/change times.\n\nOptions: stat -f / (filesystem info)",
            tree: "The 'tree' command displays directories as a tree.\n\nUsage: tree [path]\n\nOptions:\n- tree -L 2 (limit depth)\n- tree -a (show hidden)\n- tree -d (directories only)\n- tree -f (full paths)",
            base64: "The 'base64' command encodes/decodes base64.\n\nUsage:\n- echo 'text' | base64 (encode)\n- echo 'dGVzdA==' | base64 -d (decode)\n\nUseful for API tokens and data URLs.",
            md5sum: "The 'md5sum' command calculates MD5 checksums.\n\nUsage: md5sum [file]\n\nUsed to verify file integrity.\nCompare: md5sum -c checksums.txt",
            sudo: "The 'sudo' command runs commands as superuser.\n\nUsage: sudo [command]\n\nOptions:\n- sudo -i (root shell)\n- sudo -u user command (as specific user)\n- sudo -l (list your sudo privileges)\n\nUse carefully - sudo has full system access!",
            file: "The 'file' command determines file type.\n\nUsage: file [filename]\n\nExamines file content to determine type (ASCII text, ELF binary, image, archive, etc.)\n\nExample: file /bin/ls (shows 'ELF 64-bit LSB executable')",
            rev: "The 'rev' command reverses lines character by character.\n\nUsage: echo 'hello' | rev (outputs 'olleh')\n\nFun for reversing text in pipelines.",
            nl: "The 'nl' command numbers lines in a file.\n\nUsage: nl [file]\n\nOptions:\n- nl -ba file (number all lines)\n- nl -s': ' file (custom separator)",
            strings: "The 'strings' command extracts printable strings from binary files.\n\nUsage: strings [file]\n\nUseful for examining compiled programs, libraries, and binary data files."
        };

        // Check for specific command help
        for (const [cmd, help] of Object.entries(commandHelp)) {
            if (m.includes(cmd) && (m.includes('help') || m.includes('how') || m.includes('what') || m === cmd || m.includes(`whats ${cmd}`) || m.includes(`what is ${cmd}`) || m.includes(`what's ${cmd}`))) {
                return help;
            }
        }

        // General topics
        if (m.includes('pipe') || m.includes('|')) {
            return "Pipes (|) connect commands by sending output of one as input to the next.\n\nExamples:\n- ls -la | grep '.txt' (filter ls output)\n- cat file | sort | uniq (sort and deduplicate)\n- ps aux | grep python | wc -l (count python processes)\n- echo 'hello' | tr 'a-z' 'A-Z' (uppercase)\n\nYou can chain multiple pipes: cmd1 | cmd2 | cmd3";
        }

        if (m.includes('redirect') || m.includes('> file') || m.includes('output to file')) {
            return "Output redirection sends command output to files instead of the screen.\n\n- command > file (write, overwrites)\n- command >> file (append, adds to end)\n- command < file (read from file as input)\n- command 2> file (redirect errors)\n- command &> file (redirect both output and errors)\n\nExample: echo 'hello' > greeting.txt";
        }

        if (m.includes('permission') || m.includes('rwx') || m.includes('755') || m.includes('644')) {
            return "Linux file permissions use three sets of rwx (read/write/execute):\n\nOwner | Group | Others\nrwx   | rwx   | rwx\n\nNumeric values: r=4, w=2, x=1\n- 755 = rwxr-xr-x (owner full, others read+execute)\n- 644 = rw-r--r-- (owner read+write, others read)\n- 600 = rw------- (owner only)\n- 777 = rwxrwxrwx (everyone full access)\n\nUse chmod to change: chmod 755 file.sh";
        }

        if (m.includes('learn') || m.includes('start') || m.includes('beginner') || m.includes('new to linux')) {
            return "Welcome to Linux! Here's a learning path:\n\n1. Navigation: pwd, ls, cd\n2. Files: cat, touch, cp, mv, rm, mkdir\n3. Search: find, grep, locate\n4. Text processing: sort, wc, head, tail, uniq\n5. Permissions: chmod, chown, id\n6. Processes: ps, top, kill\n7. Networking: ping, netstat, curl\n8. System: df, du, free, uname\n9. Pipes and redirects: |, >, >>\n10. Shell features: history, alias, export\n\nStart with beginner challenges to practice!";
        }

        if (m.includes('challenge') || m.includes('stuck') || m.includes('hint')) {
            const completed = this.challenges.filter(c => c.completed).length;
            return `You've completed ${completed}/${this.challenges.length} challenges!\n\nTips when stuck:\n- Read the hints carefully\n- Use 'man [command]' for detailed help\n- Break the task into smaller steps\n- Try variations of the command\n- Check if you need flags (like -l, -a, -h)\n- Remember pipes (|) and redirects (>)\n\nEvery expert was once a beginner - keep trying!`;
        }

        if (m.includes('tip') || m.includes('advice') || m.includes('improve') || m.includes('shortcut')) {
            const tips = [
                "Use Tab for auto-completion - it's faster and prevents typos!",
                "Ctrl+R searches command history - start typing to find past commands.",
                "Ctrl+L clears the terminal (same as 'clear').",
                "Ctrl+C cancels a running command immediately.",
                "Ctrl+D sends EOF (end of file) - exits shell or ends input.",
                "Use '!!' to repeat the last command. 'sudo !!' is very useful!",
                "Aliases save time: alias ll='ls -la'",
                "Use 'history | grep command' to find specific past commands.",
                "Pipes are powerful: ls | grep .txt | wc -l",
                "Redirect output: command > file.txt (overwrite) or >> (append).",
                "Use 'man command' for detailed documentation on any command.",
                "Chain commands with && (run if previous succeeds) or ; (always run next).",
                "Background a process with &: longcommand &",
                "Use $() for command substitution: echo $(date)",
                "Wildcard expansion: *.txt matches all .txt files."
            ];
            return tips[Math.floor(Math.random() * tips.length)];
        }

        if (m.includes('progress') || m.includes('level') || m.includes('xp') || m.includes('stats')) {
            const cmdCount = (this.uniqueCommands && this.uniqueCommands.size) || this.user.commandsLearned || 0;
            const completed = this.challenges.filter(c => c.completed).length;
            return `Your Linux Arsenal Progress:\n\nLevel: ${this.user.level}\nXP: ${this.user.xp}\nCommands Mastered: ${cmdCount}\nChallenges Completed: ${completed}/${this.challenges.length}\nStreak: ${this.user.streak} days\nTime Spent: ${Math.floor(this.user.timeSpent / 60)}h ${this.user.timeSpent % 60}m\n\nKeep practicing to unlock more achievements!`;
        }

        if (m.includes('linux') && (m.includes('what is') || m.includes('about') || m.includes('explain'))) {
            return "Linux is an open-source operating system kernel that powers most of the world's servers, supercomputers, Android phones, and IoT devices.\n\nKey features:\n- Multi-user and multitasking\n- File-based everything (even devices are files in /dev)\n- Powerful command-line interface (CLI)\n- Shell scripting for automation\n- Package management (apt, dnf, pacman)\n- Built on Unix philosophy: small tools that do one thing well\n\nLinux distributions: Ubuntu, Debian, Arch, Fedora, CentOS, and many more.\n\nThis terminal simulates a Linux environment - practice here, then try a real one!";
        }

        if (m.includes('shell') || m.includes('bash') || m.includes('zsh')) {
            return "A shell is a command-line interpreter that lets you interact with the operating system.\n\nCommon shells:\n- bash (Bourne Again Shell) - most common, default on most Linux\n- zsh (Z Shell) - extended bash with better completion\n- fish - user-friendly with smart suggestions\n- sh - basic POSIX shell\n\nShell features:\n- Command history\n- Tab completion\n- Pipes and redirects\n- Variables and environment\n- Scripting and automation\n- Job control (background/foreground)";
        }

        if (m.includes('script') || m.includes('automat') || m.includes('cron') || m.includes('crontab')) {
            return "Shell scripting automates tasks by combining commands in a file.\n\nBasic script:\n#!/bin/bash\n# This is a comment\necho 'Hello World'\nVAR='value'\nif [ $VAR = 'value' ]; then\n  echo 'Match!'\nfi\n\nSave as script.sh, then: chmod +x script.sh && ./script.sh\n\nCron for scheduled tasks:\n- crontab -e (edit your cron jobs)\n- Format: minute hour day month weekday command\n- Example: 0 2 * * * /backup.sh (run at 2 AM daily)";
        }

        if (m.includes('process') || m.includes('kill') || m.includes('pid')) {
            return "Process management in Linux:\n\nView processes:\n- ps aux (all processes)\n- top / htop (real-time monitor)\n- pgrep name (find by name)\n\nKill processes:\n- kill PID (graceful SIGTERM)\n- kill -9 PID (force SIGKILL)\n- pkill name (kill by name)\n- killall name (kill all matching)\n\nBackground/foreground:\n- command & (run in background)\n- jobs (list background jobs)\n- fg (bring to foreground)\n- Ctrl+Z (suspend, then bg to resume in background)";
        }

        if (m.includes('network') || m.includes('connect') || m.includes('internet')) {
            return "Linux networking commands:\n\nDiagnostics:\n- ping host (test connectivity)\n- netstat -tuln (listening ports)\n- ss -tuln (modern netstat)\n- traceroute host (trace path)\n- nslookup domain (DNS lookup)\n- dig domain (detailed DNS)\n\nConfiguration:\n- ifconfig / ip addr (show interfaces)\n- ip route (routing table)\n- curl URL (HTTP request)\n- wget URL (download file)\n- ssh user@host (remote login)\n- scp file user@host:/path (secure copy)";
        }

        if (m.includes('file system') || m.includes('directory') || m.includes('folder') || m.includes('path')) {
            return "Linux file system hierarchy:\n\n/ (root - top of filesystem)\n├── /home/user (your home directory)\n├── /etc (system configuration files)\n├── /var (variable data - logs, caches)\n├── /tmp (temporary files)\n├── /usr (user programs and libraries)\n├── /bin (essential binaries)\n├── /sbin (system binaries)\n├── /dev (device files)\n├── /proc (process info as files)\n├── /opt (optional/third-party software)\n└── /root (root user's home)\n\nKey concepts:\n- Everything is a file (even devices!)\n- Paths: absolute (/home/user) vs relative (../user)\n- ~ = home directory, . = current, .. = parent\n- Hidden files start with . (dot)";
        }

        if (m.includes('text') || m.includes('search') || m.includes('filter') || m.includes('process text')) {
            return "Text processing commands in Linux:\n\n- grep 'pattern' file (search for text)\n- sed 's/old/new/g' file (find and replace)\n- awk '{print $1}' file (field processing)\n- sort file (alphabetical sort)\n- uniq (remove duplicates)\n- cut -d',' -f1 (extract fields)\n- tr 'a-z' 'A-Z' (translate characters)\n- head -n 10 (first 10 lines)\n- tail -n 10 (last 10 lines)\n- wc -l (count lines)\n- rev (reverse characters)\n- tee file (save and display)\n\nCombine with pipes for powerful processing:\ncat file | grep 'error' | sort | uniq -c | sort -rn";
        }

        if (m.includes('docker') || m.includes('container')) {
            return "Docker commands:\n\n- docker ps (running containers)\n- docker ps -a (all containers)\n- docker images (local images)\n- docker pull ubuntu (download image)\n- docker run -it ubuntu bash (start container)\n- docker build -t myapp . (build from Dockerfile)\n- docker stop container (stop)\n- docker rm container (remove)\n- docker logs container (view logs)\n- docker exec -it container bash (enter running container)\n- docker-compose up (start multi-container app)";
        }

        if (m.includes('git') || m.includes('version control')) {
            return "Git version control commands:\n\n- git init (create repository)\n- git clone URL (copy remote repo)\n- git status (check state)\n- git add . (stage all changes)\n- git commit -m 'message' (save snapshot)\n- git push (upload to remote)\n- git pull (download from remote)\n- git branch (list branches)\n- git checkout branch (switch branch)\n- git merge branch (combine branches)\n- git log (view history)\n- git diff (show changes)\n- git stash (temporarily save changes)";
        }

        if (m.includes('vim') || m.includes('nano') || m.includes('editor') || m.includes('emacs')) {
            return "Text editors in Linux:\n\nvim/vi:\n- vim file.txt (open)\n- i (insert mode), Esc (command mode)\n- :w (save), :q (quit), :wq (save & quit)\n- :q! (quit without saving)\n- dd (delete line), yy (copy line), p (paste)\n- /text (search), n (next match)\n\nnano (simpler):\n- nano file.txt (open)\n- Ctrl+O (save), Ctrl+X (exit)\n- Ctrl+K (cut line), Ctrl+U (paste)\n\nIn this terminal, use 'echo > file' or 'cat > file' to write files.";
        }

        if (m.includes('fun') || m.includes('cool') || m.includes('easter') || m.includes('joke')) {
            const fun = [
                "Try these fun commands:\n- neofetch (system info with logo)\n- cowsay 'hello' (ASCII cow speaks)\n- figlet Hello (ASCII art text)\n- cmatrix (matrix rain effect)\n- sl (steam locomotive - install it!)\n\nReal Linux fun: install 'fortune' and 'cowsay', then run: fortune | cowsay",
                "Linux Easter eggs and fun:\n- 'apt-get moo' (Debian/Ubuntu)\n- 'aptitude moo' (try with -vvv)\n- 'echo 'Hello' | rev' (reverses text)\n- 'factor 42' (prime factorization)\n- 'pi 100' (calculate pi to 100 digits)\n- 'yes hello' (repeats forever, Ctrl+C to stop)",
                "Cool terminal tricks:\n- Ctrl+R: search command history\n- !!: repeat last command (sudo !!)\n- !$: last argument of previous command\n- Alt+.: cycle through last arguments\n- Ctrl+A / Ctrl+E: jump to start/end of line\n- Ctrl+U / Ctrl+K: delete to start/end"
            ];
            return fun[Math.floor(Math.random() * fun.length)];
        }

        if (m.includes('help') || m.includes('what can you do') || m.includes('commands')) {
            return "I can help you with any Linux command or concept!\n\nAsk me about:\n- Any command: 'what is ls?', 'how does grep work?'\n- Concepts: pipes, redirects, permissions, scripting\n- Learning paths: 'how do I learn Linux?'\n- Tips: 'give me a tip'\n- Progress: 'what's my progress?'\n- Challenges: 'I'm stuck on a challenge'\n- Fun: 'show me something fun'\n\nTopics I know: file operations, text processing, permissions, processes, networking, system admin, shell scripting, Docker, Git, and more!\n\nJust ask me anything!";
        }

        // Default responses
        const responses = [
            "I'm here to help you master Linux! Ask me about any command, concept, or challenge. Try: 'how does grep work?' or 'what is chmod?'",
            "What Linux topic would you like to explore? I can explain commands, show examples, or suggest practice exercises. Try: 'explain pipes' or 'what is find?'",
            "Need help? Ask me about specific commands (ls, grep, chmod, etc.), concepts (pipes, permissions, scripting), or request tips and challenges!",
            "Try asking: 'how do I use tar?', 'what are file permissions?', 'explain pipes and redirects', or 'give me a tip'.",
            "I know about 80+ Linux commands and concepts. Ask me about any command, or try: 'how do I learn Linux?', 'what is a shell?', or 'show me something fun'!"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // Notification System
    showNotification(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (container) {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            const iconMap = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
            toast.innerHTML = `<i class="fas ${iconMap[type] || iconMap.info}"></i><span>${this.escapeHtml(message)}</span>`;
            container.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 4000);
        } else {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 4000);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LinuxArsenal();
});

// Add CSS for current user highlighting in leaderboard
const style = document.createElement('style');
style.textContent = `
    .leaderboard-entry.current-user {
        background: rgba(0, 255, 65, 0.1);
        border-left: 3px solid var(--accent-green);
    }
`;
document.head.appendChild(style);
