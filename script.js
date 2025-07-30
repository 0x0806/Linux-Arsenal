// Linux Arsenal - Interactive Linux Learning Platform
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

        this.initializeApp();
        this.loadUserData();
        this.generateChallenges();
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
            this.user = { ...this.user, ...JSON.parse(savedData) };
        }
        this.updateUserDisplay();
    }

    saveUserData() {
        localStorage.setItem('linuxArsenalUser', JSON.stringify(this.user));
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
        commandDiv.innerHTML = `
            <span class="command-prompt">user@linux-arsenal:${this.getDisplayPath()}$</span>
            <span class="command-text">${command}</span>
        `;
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

    addToHistory(command) {
        this.commandHistory.push(command);
        if (this.commandHistory.length > 100) {
            this.commandHistory = this.commandHistory.slice(-100);
        }
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        const historyContent = document.getElementById('history-content');
        const recentCommands = this.commandHistory.slice(-10).reverse();

        historyContent.innerHTML = recentCommands.map(cmd => 
            `<div class="history-item">${cmd}</div>`
        ).join('') || '<div class="history-item">No commands yet</div>';
    }

    // File system operations
    listFiles(args) {
        const showHidden = args.includes('-a');
        const longFormat = args.includes('-l');
        const path = args.find(arg => !arg.startsWith('-')) || this.currentDirectory;

        const resolvedPath = this.resolvePath(path);
        const node = this.getNode(resolvedPath);

        if (!node) {
            throw new Error(`ls: cannot access '${path}': No such file or directory`);
        }

        if (node.type !== 'directory') {
            return path;
        }

        const items = Object.keys(node.children)
            .filter(name => showHidden || !name.startsWith('.'))
            .sort();

        if (longFormat) {
            return items.map(name => {
                const child = node.children[name];
                const type = child.type === 'directory' ? 'd' : '-';
                const perms = 'rwxr-xr-x';
                const size = child.content ? child.content.length : 4096;
                const date = 'Jan 1 12:00';
                return `${type}${perms} 1 user user ${this.formatFileSize(size).padStart(8)} ${date} ${name}`;
            }).join('\n');
        }

        return items.join('  ');
    }

    changeDirectory(path) {
        if (path === '~' || path === '') {
            this.currentDirectory = '/home/user';
            return '';
        }

        const resolvedPath = this.resolvePath(path);
        const node = this.getNode(resolvedPath);

        if (!node) {
            throw new Error(`cd: ${path}: No such file or directory`);
        }

        if (node.type !== 'directory') {
            throw new Error(`cd: ${path}: Not a directory`);
        }

        this.currentDirectory = resolvedPath;
        return '';
    }

    readFile(filename) {
        if (!filename) {
            throw new Error('cat: missing file operand');
        }

        const path = this.resolvePath(filename);
        const node = this.getNode(path);

        if (!node) {
            throw new Error(`cat: ${filename}: No such file or directory`);
        }

        if (node.type !== 'file') {
            throw new Error(`cat: ${filename}: Is a directory`);
        }

        return node.content || '';
    }

    makeDirectory(dirname) {
        if (!dirname) {
            throw new Error('mkdir: missing operand');
        }

        const path = this.resolvePath(dirname);
        const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
        const dirName = path.substring(path.lastIndexOf('/') + 1);

        const parentNode = this.getNode(parentPath);
        if (!parentNode || parentNode.type !== 'directory') {
            throw new Error(`mkdir: cannot create directory '${dirname}': No such file or directory`);
        }

        if (parentNode.children[dirName]) {
            throw new Error(`mkdir: cannot create directory '${dirname}': File exists`);
        }

        parentNode.children[dirName] = {
            type: 'directory',
            children: {}
        };

        return '';
    }

    createFile(filename) {
        if (!filename) {
            throw new Error('touch: missing file operand');
        }

        const path = this.resolvePath(filename);
        const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
        const fileName = path.substring(path.lastIndexOf('/') + 1);

        const parentNode = this.getNode(parentPath);
        if (!parentNode || parentNode.type !== 'directory') {
            throw new Error(`touch: cannot touch '${filename}': No such file or directory`);
        }

        if (!parentNode.children[fileName]) {
            parentNode.children[fileName] = {
                type: 'file',
                content: ''
            };
        }

        return '';
    }

    removeFile(args) {
        if (!args || args.length === 0) {
            throw new Error('rm: missing operand');
        }

        const filename = args[0];
        const recursive = args.includes('-r') || args.includes('-rf');
        const path = this.resolvePath(filename);
        const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
        const fileName = path.substring(path.lastIndexOf('/') + 1);

        const parentNode = this.getNode(parentPath);
        if (!parentNode || parentNode.type !== 'directory') {
            throw new Error(`rm: cannot remove '${filename}': No such file or directory`);
        }

        const targetNode = parentNode.children[fileName];
        if (!targetNode) {
            throw new Error(`rm: cannot remove '${filename}': No such file or directory`);
        }

        if (targetNode.type === 'directory' && !recursive) {
            throw new Error(`rm: cannot remove '${filename}': Is a directory`);
        }

        delete parentNode.children[fileName];
        return '';
    }

    copyFile(source, destination) {
        if (!source || !destination) {
            throw new Error('cp: missing file operand');
        }

        const srcPath = this.resolvePath(source);
        const srcNode = this.getNode(srcPath);

        if (!srcNode) {
            throw new Error(`cp: cannot stat '${source}': No such file or directory`);
        }

        if (srcNode.type !== 'file') {
            throw new Error(`cp: '${source}': Is a directory`);
        }

        const dstPath = this.resolvePath(destination);
        const dstParentPath = dstPath.substring(0, dstPath.lastIndexOf('/')) || '/';
        const dstFileName = dstPath.substring(dstPath.lastIndexOf('/') + 1);

        const dstParentNode = this.getNode(dstParentPath);
        if (!dstParentNode || dstParentNode.type !== 'directory') {
            throw new Error(`cp: cannot create regular file '${destination}': No such file or directory`);
        }

        dstParentNode.children[dstFileName] = {
            type: 'file',
            content: srcNode.content
        };

        return '';
    }

    moveFile(source, destination) {
        if (!source || !destination) {
            throw new Error('mv: missing file operand');
        }

        // First copy the file
        this.copyFile(source, destination);

        // Then remove the source
        this.removeFile([source]);

        return '';
    }

    removeDirectory(dirname) {
        if (!dirname) {
            throw new Error('rmdir: missing operand');
        }

        const path = this.resolvePath(dirname);
        const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
        const dirName = path.substring(path.lastIndexOf('/') + 1);

        const parentNode = this.getNode(parentPath);
        if (!parentNode || parentNode.type !== 'directory') {
            throw new Error(`rmdir: failed to remove '${dirname}': No such file or directory`);
        }

        const targetNode = parentNode.children[dirName];
        if (!targetNode) {
            throw new Error(`rmdir: failed to remove '${dirname}': No such file or directory`);
        }

        if (targetNode.type !== 'directory') {
            throw new Error(`rmdir: failed to remove '${dirname}': Not a directory`);
        }

        if (Object.keys(targetNode.children).length > 0) {
            throw new Error(`rmdir: failed to remove '${dirname}': Directory not empty`);
        }

        delete parentNode.children[dirName];
        return '';
    }

    grepCommand(args) {
        if (args.length < 2) {
            throw new Error('grep: missing pattern or file');
        }

        const pattern = args[0];
        const filename = args[1];
        const path = this.resolvePath(filename);
        const node = this.getNode(path);

        if (!node) {
            throw new Error(`grep: ${filename}: No such file or directory`);
        }

        if (node.type !== 'file') {
            throw new Error(`grep: ${filename}: Is a directory`);
        }

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
                if (namePattern === '*' || currentPath.includes(namePattern.replace('*', ''))) {
                    results.push(currentPath);
                }
            } else if (node.type === 'directory') {
                Object.keys(node.children).forEach(childName => {
                    const childPath = currentPath + (currentPath.endsWith('/') ? '' : '/') + childName;
                    search(childPath, node.children[childName]);
                });
            }
        };

        const startNode = this.getNode(this.resolvePath(path));
        if (startNode) {
            search(path, startNode);
        }

        return results.join('\n');
    }

    // Utility functions for path resolution
    resolvePath(path) {
        if (path.startsWith('/')) {
            return path;
        }

        if (path === '~') {
            return '/home/user';
        }

        if (path.startsWith('~/')) {
            return '/home/user' + path.substring(1);
        }

        if (path === '..') {
            const parts = this.currentDirectory.split('/');
            parts.pop();
            return parts.join('/') || '/';
        }

        if (path.startsWith('../')) {
            const parts = this.currentDirectory.split('/');
            parts.pop();
            return (parts.join('/') || '/') + path.substring(2);
        }

        return this.currentDirectory + (this.currentDirectory.endsWith('/') ? '' : '/') + path;
    }

    getNode(path) {
        if (!path || path === '/') {
            return this.filesystem['/'];
        }

        const parts = path.split('/').filter(p => p);
        let node = this.filesystem['/'];

        for (const part of parts) {
            if (!node || !node.children || !node.children[part]) {
                return null;
            }
            node = node.children[part];
        }

        return node;
    }

    // Additional utility functions
    validateCommand(command) {
        const allowedCommands = [
            'help', 'tutorial', 'ls', 'cd', 'pwd', 'cat', 'mkdir', 'rmdir', 
            'touch', 'rm', 'cp', 'mv', 'grep', 'find', 'echo', 'whoami', 
            'date', 'uname', 'clear', 'history', 'man', 'sort', 'wc', 
            'head', 'tail', 'ps', 'du', 'free', 'uptime', 'ifconfig', 
            'ping', 'nslookup', 'chmod', 'chown', 'ln', 'tar'
        ];
        return allowedCommands.includes(command.toLowerCase());
    }

    formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    formatDate(timestamp) {
        return new Date(timestamp || Date.now()).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getHelpText() {
        return `Available Commands:
Basic Navigation:
  ls [options]     - List directory contents
  cd [directory]   - Change directory
  pwd             - Print working directory

File Operations:
  cat [file]      - Display file contents
  touch [file]    - Create empty file
  mkdir [dir]     - Create directory
  rmdir [dir]     - Remove empty directory
  rm [file]       - Remove file
  cp [src] [dst]  - Copy file
  mv [src] [dst]  - Move/rename file

Text Processing:
  grep [pattern]  - Search for patterns
  find [path]     - Find files and directories
  echo [text]     - Display text

System Information:
  whoami          - Display current user
  date            - Display current date and time
  uname           - Display system information
  history         - Show command history
  man [command]   - Show manual for command

Other:
  clear           - Clear the terminal
  help            - Show this help message
  tutorial        - Start interactive tutorial

Use 'man [command]' for detailed information about specific commands.`;
    }

    startTutorial() {
        return `Welcome to the Linux Arsenal Tutorial!

Let's start with basic navigation:

1. First, let's see where we are:
   Type: pwd

2. List the contents of the current directory:
   Type: ls

3. List with more details:
   Type: ls -l

4. Try changing to the documents directory:
   Type: cd documents

5. Go back to the parent directory:
   Type: cd ..

Continue exploring! Type 'help' anytime to see available commands.`;
    }

    showHistory() {
        return this.commandHistory.map((cmd, i) => `${i + 1}  ${cmd}`).join('\n');
    }

    showManual(command) {
        const manuals = {
            ls: `NAME
       ls - list directory contents

SYNOPSIS
       ls [OPTION]... [FILE]...

DESCRIPTION
       List information about the FILEs (the current directory by default).

OPTIONS
       -a     do not ignore entries starting with .
       -l     use a long listing format`,

            cd: `NAME
       cd - change directory

SYNOPSIS
       cd [DIRECTORY]

DESCRIPTION
       Change the current directory to DIRECTORY.
       If no directory is specified, change to home directory.`,

            cat: `NAME
       cat - concatenate files and print on the standard output

SYNOPSIS
       cat [FILE]...

DESCRIPTION
       Concatenate FILE(s) to standard output.`,

            pwd: `NAME
       pwd - print name of current/working directory

SYNOPSIS
       pwd

DESCRIPTION
       Print the full filename of the current working directory.`
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
            "Try 'ls -la' to see hidden files and detailed information",
            "Use 'cd ..' to go up one directory level",
            "The 'tab' key can help complete commands and filenames",
            "Use 'history' to see your previous commands",
            "Try 'grep [pattern] [file]' to search within files",
            "Use 'find [path] -name [pattern]' to search for files"
        ];

        const randomHint = hints[Math.floor(Math.random() * hints.length)];
        document.getElementById('hint-content').textContent = randomHint;
    }

    handleTabCompletion(input) {
        const value = input.value;
        const parts = value.split(' ');
        const lastPart = parts[parts.length - 1];

        if (parts.length === 1) {
            // Complete command
            const commands = ['ls', 'cd', 'pwd', 'cat', 'mkdir', 'touch', 'rm', 'cp', 'mv', 'grep', 'find', 'echo', 'help', 'history', 'man', 'clear'];
            const matches = commands.filter(cmd => cmd.startsWith(lastPart));

            if (matches.length === 1) {
                input.value = matches[0] + ' ';
            } else if (matches.length > 1) {
                this.addOutputToTerminal(matches.join('  '));
            }
        } else {
            // Complete filename/directory
            const node = this.getNode(this.currentDirectory);
            if (node && node.children) {
                const matches = Object.keys(node.children).filter(name => 
                    name.startsWith(lastPart)
                );

                if (matches.length === 1) {
                    parts[parts.length - 1] = matches[0];
                    input.value = parts.join(' ') + ' ';
                } else if (matches.length > 1) {
                    this.addOutputToTerminal(matches.join('  '));
                }
            }
        }
    }

    trackCommandUsage(command, success) {
        // Convert to Set to count unique commands
        const currentCommands = typeof this.user.commandsLearned === 'number' ? 
            new Set() : new Set(this.user.commandsLearned || []);
        currentCommands.add(command);
        this.user.commandsLearned = currentCommands.size;

        if (success) {
            this.user.xp += 10;
            this.updateSkillXP(command, 15);
            
            // Bonus XP for streaks
            if (this.user.streak > 0) {
                this.user.xp += Math.min(this.user.streak * 2, 20);
            }
        }

        // Update level with better progression
        const newLevel = Math.floor(this.user.xp / 150) + 1;
        if (newLevel > this.user.level) {
            this.user.level = newLevel;
            this.showNotification(`🎉 Level Up! You are now level ${newLevel}!`, 'success');
            this.user.xp += 25; // Level up bonus
        }

        this.updateUserDisplay();
        this.checkAchievements();
    }

    updateSkillXP(command, xp) {
        const skillMapping = {
            'ls': 'file-ops',
            'cd': 'file-ops',
            'pwd': 'file-ops',
            'cat': 'file-ops',
            'mkdir': 'file-ops',
            'touch': 'file-ops',
            'rm': 'file-ops',
            'cp': 'file-ops',
            'mv': 'file-ops',
            'grep': 'text-proc',
            'find': 'text-proc',
            'echo': 'text-proc',
            'whoami': 'sys-admin',
            'uname': 'sys-admin',
            'date': 'sys-admin'
        };

        const skill = skillMapping[command];
        if (skill) {
            this.user.skills[skill] += xp;
        }
    }

    updateUserProgress(command, success) {
        if (success) {
            this.user.timeSpent += 1; // Simplified time tracking

            // Update accuracy
            const totalCommands = this.commandHistory.length;
            const successfulCommands = totalCommands; // Simplified for demo
            this.user.accuracy = Math.round((successfulCommands / totalCommands) * 100);
        }
    }

    // Challenge System
    generateChallenges() {
        // Comprehensive challenge templates covering all Linux domains
        const challengeTemplates = {
            beginner: {
                "File Operations": [
                    {
                        title: "List Directory Contents",
                        description: "Use the 'ls' command to list all files in the current directory.",
                        xp: 25,
                        solution: "ls",
                        hints: ["The 'ls' command shows directory contents", "Just type 'ls' and press Enter"]
                    },
                    {
                        title: "Navigate to Home Directory",
                        description: "Change to your home directory using the 'cd' command.",
                        xp: 25,
                        solution: "cd ~",
                        hints: ["Use 'cd' followed by the path", "The tilde (~) represents your home directory"]
                    },
                    {
                        title: "Create a New Directory",
                        description: "Create a directory named 'test' in your current location.",
                        xp: 30,
                        solution: "mkdir test",
                        hints: ["Use the 'mkdir' command", "Follow it with the directory name"]
                    },
                    {
                        title: "Find Your Current Location",description: "Display the full path of your current working directory.",
                        xp: 20,
                        solution: "pwd",
                        hints: ["The 'pwd' command shows your current path", "PWD stands for 'Print Working Directory'"]
                    },
                    {
                        title: "Display File Contents",
                        description: "Use the 'cat' command to display the contents of readme.txt.",
                        xp: 35,
                        solution: "cat documents/readme.txt",
                        hints: ["Navigate to documents directory first", "Use 'cat' followed by the filename"]
                    },
                    {
                        title: "Create Empty File",
                        description: "Create an empty file named 'newfile.txt' using the touch command.",
                        xp: 25,
                        solution: "touch newfile.txt",
                        hints: ["Use 'touch' command", "Follow with the filename you want to create"]
                    },
                    {
                        title: "Copy a File",
                        description: "Copy the file 'readme.txt' from documents to your current directory.",
                        xp: 40,
                        solution: "cp documents/readme.txt .",
                        hints: ["Use 'cp' command", "Source file first, then destination", "Use '.' for current directory"]
                    },
                    {
                        title: "Remove a File",
                        description: "Remove the file 'newfile.txt' from your current directory.",
                        xp: 30,
                        solution: "rm newfile.txt",
                        hints: ["Use 'rm' command", "Be careful - this permanently deletes files!"]
                    },
                    {
                        title: "List with Details",
                        description: "List files in the current directory with detailed information using long format.",
                        xp: 35,
                        solution: "ls -l",
                        hints: ["Use ls with the -l flag", "This shows permissions, size, and date"]
                    },
                    {
                        title: "Show Hidden Files",
                        description: "List all files including hidden ones in the current directory.",
                        xp: 30,
                        solution: "ls -a",
                        hints: ["Use ls with the -a flag", "Hidden files start with a dot (.)"]
                    }
                ],
                "Text Processing": [
                    {
                        title: "Echo Text",
                        description: "Display the text 'Hello World' using the echo command.",
                        xp: 15,
                        solution: "echo Hello World",
                        hints: ["Use 'echo' command", "Follow with the text you want to display"]
                    },
                    {
                        title: "Count Lines in File",
                        description: "Count the number of lines in the readme.txt file using wc command.",
                        xp: 35,
                        solution: "wc -l documents/readme.txt",
                        hints: ["Use 'wc' command with -l flag", "Specify the file path"]
                    },
                    {
                        title: "Display First 5 Lines",
                        description: "Show the first 5 lines of the readme.txt file using head command.",
                        xp: 30,
                        solution: "head -n 5 documents/readme.txt",
                        hints: ["Use 'head' command", "Use -n flag to specify number of lines"]
                    },
                    {
                        title: "Display Last 3 Lines",
                        description: "Show the last 3 lines of the readme.txt file using tail command.",
                        xp: 30,
                        solution: "tail -n 3 documents/readme.txt",
                        hints: ["Use 'tail' command", "Use -n flag to specify number of lines"]
                    }
                ],
                "System Administration": [
                    {
                        title: "Check Current User",
                        description: "Display the current username using the whoami command.",
                        xp: 20,
                        solution: "whoami",
                        hints: ["Use 'whoami' command", "This shows your current username"]
                    },
                    {
                        title: "Display Current Date",
                        description: "Show the current system date and time using the date command.",
                        xp: 20,
                        solution: "date",
                        hints: ["Use 'date' command", "This displays current system time"]
                    },
                    {
                        title: "System Information",
                        description: "Display basic system information using the uname command.",
                        xp: 25,
                        solution: "uname",
                        hints: ["Use 'uname' command", "This shows system kernel name"]
                    },
                    {
                        title: "Detailed System Info",
                        description: "Display detailed system information using uname with all flags.",
                        xp: 40,
                        solution: "uname -a",
                        hints: ["Use 'uname' with -a flag", "This shows all system information"]
                    }
                ]
            },
            intermediate: {
                "File Operations": [
                    {
                        title: "Recursive Directory Listing",
                        description: "List all files and subdirectories recursively in the home directory.",
                        xp: 50,
                        solution: "ls -R ~",
                        hints: ["Use ls with -R flag for recursive", "~ represents home directory"]
                    },
                    {
                        title: "Copy Directory Recursively",
                        description: "Copy the entire documents directory to a new directory called backup.",
                        xp: 60,
                        solution: "cp -r documents backup",
                        hints: ["Use cp with -r flag for recursive copy", "Source directory first, then destination"]
                    },
                    {
                        title: "Move and Rename",
                        description: "Move the file readme.txt to the projects directory and rename it to info.txt.",
                        xp: 55,
                        solution: "mv documents/readme.txt projects/info.txt",
                        hints: ["Use 'mv' command", "Specify full path with new name"]
                    },
                    {
                        title: "Create Directory Structure",
                        description: "Create a nested directory structure: project/src/main in one command.",
                        xp: 45,
                        solution: "mkdir -p project/src/main",
                        hints: ["Use mkdir with -p flag", "This creates parent directories as needed"]
                    },
                    {
                        title: "Find Files by Size",
                        description: "Find all files larger than 1KB in the home directory.",
                        xp: 65,
                        solution: "find ~ -size +1k",
                        hints: ["Use 'find' command with -size option", "+1k means larger than 1 kilobyte"]
                    },
                    {
                        title: "File Permissions Check",
                        description: "Display detailed permissions for all files in the current directory.",
                        xp: 50,
                        solution: "ls -la",
                        hints: ["Use ls with -la flags", "This shows all files with permissions"]
                    }
                ],
                "Text Processing": [
                    {
                        title: "Search for Text Patterns",
                        description: "Use 'grep' to find lines containing 'user' in the /etc/passwd file.",
                        xp: 50,
                        solution: "grep user /etc/passwd",
                        hints: ["grep searches for patterns in files", "Syntax: grep [pattern] [file]"]
                    },
                    {
                        title: "Case Insensitive Search",
                        description: "Search for 'USER' in /etc/passwd ignoring case sensitivity.",
                        xp: 55,
                        solution: "grep -i user /etc/passwd",
                        hints: ["Use grep with -i flag", "This ignores case differences"]
                    },
                    {
                        title: "Count Pattern Matches",
                        description: "Count how many lines contain 'bash' in the /etc/passwd file.",
                        xp: 60,
                        solution: "grep -c bash /etc/passwd",
                        hints: ["Use grep with -c flag", "This counts matching lines"]
                    },
                    {
                        title: "Sort File Contents",
                        description: "Sort the contents of /etc/passwd alphabetically.",
                        xp: 45,
                        solution: "sort /etc/passwd",
                        hints: ["Use 'sort' command", "This arranges lines alphabetically"]
                    },
                    {
                        title: "Remove Duplicate Lines",
                        description: "Display unique lines from a file by removing duplicates using uniq.",
                        xp: 50,
                        solution: "sort /etc/passwd | uniq",
                        hints: ["Use 'uniq' command", "Usually combined with sort using pipe |"]
                    },
                    {
                        title: "Word Count Analysis",
                        description: "Count words, lines, and characters in the readme.txt file.",
                        xp: 40,
                        solution: "wc documents/readme.txt",
                        hints: ["Use 'wc' command without flags", "Shows lines, words, and characters"]
                    }
                ],
                "System Administration": [
                    {
                        title: "Process List",
                        description: "Display all currently running processes using ps command.",
                        xp: 55,
                        solution: "ps aux",
                        hints: ["Use 'ps' with aux flags", "Shows all processes with details"]
                    },
                    {
                        title: "Disk Usage",
                        description: "Check disk usage of the current directory in human-readable format.",
                        xp: 50,
                        solution: "du -h",
                        hints: ["Use 'du' command with -h flag", "Human-readable shows sizes in KB, MB, GB"]
                    },
                    {
                        title: "Free Memory",
                        description: "Display available system memory in human-readable format.",
                        xp: 45,
                        solution: "free -h",
                        hints: ["Use 'free' command with -h flag", "Shows RAM and swap usage"]
                    },
                    {
                        title: "System Uptime",
                        description: "Display how long the system has been running using uptime command.",
                        xp: 35,
                        solution: "uptime",
                        hints: ["Use 'uptime' command", "Shows system uptime and load average"]
                    }
                ],
                "Networking": [
                    {
                        title: "Network Interfaces",
                        description: "Display network interface configuration using ifconfig.",
                        xp: 60,
                        solution: "ifconfig",
                        hints: ["Use 'ifconfig' command", "Shows network interface details"]
                    },
                    {
                        title: "Ping Test",
                        description: "Test network connectivity by sending 3 ping packets to google.com.",
                        xp: 50,
                        solution: "ping -c 3 google.com",
                        hints: ["Use 'ping' with -c flag", "Specify count of packets to send"]
                    },
                    {
                        title: "DNS Lookup",
                        description: "Perform a DNS lookup for google.com using nslookup command.",
                        xp: 55,
                        solution: "nslookup google.com",
                        hints: ["Use 'nslookup' command", "Shows DNS information for domain"]
                    }
                ]
            },
            advanced: {
                "File Operations": [
                    {
                        title: "Advanced Find with Multiple Criteria",
                        description: "Find all .txt files modified in the last 7 days in the home directory.",
                        xp: 80,
                        solution: "find ~ -name '*.txt' -mtime -7",
                        hints: ["Use find with multiple options", "-mtime -7 means modified within 7 days"]
                    },
                    {
                        title: "Symbolic Links",
                        description: "Create a symbolic link named 'shortcut' pointing to the documents directory.",
                        xp: 70,
                        solution: "ln -s documents shortcut",
                        hints: ["Use 'ln' with -s flag", "Syntax: ln -s target linkname"]
                    },
                    {
                        title: "Archive Creation",
                        description: "Create a compressed tar archive of the documents directory named docs.tar.gz.",
                        xp: 90,
                        solution: "tar -czf docs.tar.gz documents",
                        hints: ["Use 'tar' command", "-czf creates compressed archive"]
                    },
                    {
                        title: "Batch File Operations",
                        description: "Find all .txt files and copy them to a backup directory in one command.",
                        xp: 85,
                        solution: "find . -name '*.txt' -exec cp {} backup/ \\;",
                        hints: ["Use find with -exec option", "{} represents found files"]
                    }
                ],
                "Text Processing": [
                    {
                        title: "Advanced Text Processing",
                        description: "Find all lines in /etc/passwd that contain 'bash' and count them.",
                        xp: 90,
                        solution: "grep -c bash /etc/passwd",
                        hints: ["grep can count matches with -c", "Look for 'bash' in the passwd file"]
                    },
                    {
                        title: "Text Replacement",
                        description: "Replace all occurrences of 'old' with 'new' in a file using sed.",
                        xp: 95,
                        solution: "sed 's/old/new/g' filename",
                        hints: ["Use 'sed' command", "s/old/new/g replaces all occurrences"]
                    },
                    {
                        title: "Extract Specific Columns",
                        description: "Extract the first and third columns from /etc/passwd using awk.",
                        xp: 100,
                        solution: "awk -F: '{print $1, $3}' /etc/passwd",
                        hints: ["Use 'awk' command", "-F: sets field separator to colon"]
                    },
                    {
                        title: "Complex Pattern Matching",
                        description: "Find lines that start with 'user' and end with 'bash' using grep with regex.",
                        xp: 85,
                        solution: "grep '^user.*bash$' /etc/passwd",
                        hints: ["Use regex with grep", "^ means start, $ means end, .* matches anything"]
                    }
                ],
                "System Administration": [
                    {
                        title: "Service Status Check",
                        description: "Check the status of system services using systemctl.",
                        xp: 75,
                        solution: "systemctl status",
                        hints: ["Use 'systemctl' command", "Shows system service status"]
                    },
                    {
                        title: "Monitor System Resources",
                        description: "Display real-time system resource usage using top command.",
                        xp: 70,
                        solution: "top",
                        hints: ["Use 'top' command", "Shows live system resource usage"]
                    },
                    {
                        title: "File System Information",
                        description: "Display file system disk space usage with df command.",
                        xp: 65,
                        solution: "df -h",
                        hints: ["Use 'df' command with -h flag", "Shows mounted file systems"]
                    }
                ],
                "Security": [
                    {
                        title: "File Permissions Management",
                        description: "Change file permissions to read-write for owner, read-only for others.",
                        xp: 80,
                        solution: "chmod 644 filename",
                        hints: ["Use 'chmod' command", "644 means rw-r--r--"]
                    },
                    {
                        title: "Directory Permissions",
                        description: "Set directory permissions to allow full access for owner, execute for others.",
                        xp: 85,
                        solution: "chmod 755 dirname",
                        hints: ["Use 'chmod' command", "755 means rwxr-xr-x"]
                    },
                    {
                        title: "Change File Ownership",
                        description: "Change the owner of a file to user 'newowner' using chown.",
                        xp: 75,
                        solution: "chown newowner filename",
                        hints: ["Use 'chown' command", "Syntax: chown newowner filename"]
                    }
                ],
                "Scripting": [
                    {
                        title: "Environment Variables",
                        description: "Display all environment variables using printenv command.",
                        xp: 60,
                        solution: "printenv",
                        hints: ["Use 'printenv' command", "Shows all environment variables"]
                    },
                    {
                        title: "Command History",
                        description: "Display your command history using the history command.",
                        xp: 50,
                        solution: "history",
                        hints: ["Use 'history' command", "Shows previously executed commands"]
                    },
                    {
                        title: "Alias Creation",
                        description: "Create an alias 'll' for 'ls -la' command.",
                        xp: 70,
                        solution: "alias ll='ls -la'",
                        hints: ["Use 'alias' command", "Syntax: alias name='command'"]
                    }
                ]
            },
            expert: {
                "Advanced Scripting": [
                    {
                        title: "Complex Pipeline",
                        description: "Create a pipeline to find the 10 largest files in the system.",
                        xp: 120,
                        solution: "find / -type f -exec ls -la {} \\; 2>/dev/null | sort -k5 -n | tail -10",
                        hints: ["Use find with exec", "Sort by file size", "Get last 10 results"]
                    },
                    {
                        title: "Process Management",
                        description: "Find and kill all processes matching a specific name pattern.",
                        xp: 110,
                        solution: "pkill -f processname",
                        hints: ["Use 'pkill' command", "-f matches full command line"]
                    },
                    {
                        title: "System Monitoring Script",
                        description: "Create a one-liner to monitor CPU usage every 5 seconds.",
                        xp: 130,
                        solution: "while true; do top -bn1 | grep 'Cpu(s)'; sleep 5; done",
                        hints: ["Use while loop", "top -bn1 for single iteration", "sleep for delay"]
                    }
                ],
                "Network Security": [
                    {
                        title: "Port Scanning",
                        description: "Scan for open ports on localhost using netstat.",
                        xp: 100,
                        solution: "netstat -tuln",
                        hints: ["Use 'netstat' command", "-tuln shows listening ports"]
                    },
                    {
                        title: "Network Connections",
                        description: "Display all active network connections with process information.",
                        xp: 110,
                        solution: "netstat -tulnp",
                        hints: ["Use 'netstat' with -p flag", "Shows process names and PIDs"]
                    }
                ],
                "System Forensics": [
                    {
                        title: "Log Analysis",
                        description: "Find all failed login attempts in system logs.",
                        xp: 140,
                        solution: "grep 'Failed password' /var/log/auth.log",
                        hints: ["Use 'grep' on log files", "Look for 'Failed password' pattern"]
                    },
                    {
                        title: "File Integrity Check",
                        description: "Generate MD5 checksums for all files in a directory.",
                        xp: 120,
                        solution: "find . -type f -exec md5sum {} \\;",
                        hints: ["Use find with exec", "md5sum generates checksums"]
                    }
                ]
            }
        };

        // Generate comprehensive challenge set
        this.challenges = [];
        let challengeId = 0;

        Object.keys(challengeTemplates).forEach(difficulty => {
            Object.keys(challengeTemplates[difficulty]).forEach(category => {
                const templates = challengeTemplates[difficulty][category];

                // Add original templates
                templates.forEach((template, index) => {
                    this.challenges.push({
                        ...template,
                        id: `${difficulty}_${category}_${index}`,
                        difficulty: difficulty,
                        category: category,
                        completed: false
                    });
                });

                // Generate variations of each template
                templates.forEach((template, templateIndex) => {
                    for (let variation = 1; variation <= 20; variation++) {
                        const variationChallenge = this.createChallengeVariation(template, difficulty, category, variation);
                        this.challenges.push({
                            ...variationChallenge,
                            id: `${difficulty}_${category}_${templateIndex}_var_${variation}`,
                            completed: false
                        });
                    }
                });
            });
        });

        // Generate additional dynamic challenges
        this.generateDynamicChallenges();

        console.log(`Generated ${this.challenges.length} challenges across all difficulty levels`);
    }

    createChallengeVariation(template, difficulty, category, variation) {
        const variations = {
            "File Operations": [
                { suffix: "in the /tmp directory", solutionModifier: (sol) => sol.replace(".", "/tmp") },
                { suffix: "with verbose output", solutionModifier: (sol) => sol + " -v" },
                { suffix: "including hidden files", solutionModifier: (sol) => sol.includes("ls") ? sol + " -a" : sol },
                { suffix: "with long format", solutionModifier: (sol) => sol.includes("ls") ? sol + " -l" : sol },
                { suffix: "recursively", solutionModifier: (sol) => sol + " -r" }
            ],
            "Text Processing": [
                { suffix: "with line numbers", solutionModifier: (sol) => sol.includes("grep") ? sol + " -n" : sol },
                { suffix: "case insensitive", solutionModifier: (sol) => sol.includes("grep") ? sol + " -i" : sol },
                { suffix: "in reverse order", solutionModifier: (sol) => sol.includes("sort") ? sol + " -r" : sol },
                { suffix: "with count only", solutionModifier: (sol) => sol.includes("grep") ? sol.replace("grep", "grep -c") : sol }
            ],
            "System Administration": [
                { suffix: "in human readable format", solutionModifier: (sol) => sol + " -h" },
                { suffix: "with timestamps", solutionModifier: (sol) => sol + " | head -20" },
                { suffix: "sorted by usage", solutionModifier: (sol) => sol + " | sort -k2 -n" }
            ],
            "Networking": [
                { suffix: "with IPv4 only", solutionModifier: (sol) => sol + " -4" },
                { suffix: "with detailed output", solutionModifier: (sol) => sol + " -v" },
                { suffix: "with timeout of 10 seconds", solutionModifier: (sol) => sol.includes("ping") ? sol + " -W 10" : sol }
            ],
            "Security": [
                { suffix: "recursively", solutionModifier: (sol) => sol + " -R" },
                { suffix: "with symbolic notation", solutionModifier: (sol) => sol.replace(/\d{3}/, "u+rw,g+r,o+r") }
            ],
            "Scripting": [
                { suffix: "with custom format", solutionModifier: (sol) => sol + " | head -10" },
                { suffix: "filtered by pattern", solutionModifier: (sol) => sol + " | grep user" }
            ]
        };

        const categoryVariations = variations[category] || variations["File Operations"];
        const selectedVariation = categoryVariations[variation % categoryVariations.length];

        return {
            title: `${template.title} ${selectedVariation.suffix}`,
            description: `${template.description} ${selectedVariation.suffix}.`,
            difficulty: difficulty,
            category: category,
            xp: template.xp + (variation * 2),
            solution: selectedVariation.solutionModifier(template.solution),
            hints: [...template.hints, `Try adding appropriate flags for ${selectedVariation.suffix}`]
        };
    }

    generateDynamicChallenges() {
        // Generate scenario-based challenges
        const scenarios = [
            "You are a system administrator managing a web server",
            "You are investigating a security incident",
            "You are setting up a development environment",
            "You are performing system maintenance",
            "You are troubleshooting network issues",
            "You are analyzing log files for errors",
            "You are backing up important data",
            "You are monitoring system performance"
        ];

        const dynamicTasks = [
            "Find configuration files", "Check service status", "Monitor resource usage",
            "Analyze log patterns", "Verify file permissions", "Test network connectivity",
            "Create backup scripts", "Search for error messages", "Track user activity",
            "Optimize system performance", "Secure sensitive files", "Automate routine tasks"
        ];

        // Generate 1000 scenario-based challenges
        for (let i = 0; i < 1000; i++) {
            const scenario = scenarios[i % scenarios.length];
            const task = dynamicTasks[i % dynamicTasks.length];
            const difficulty = ["beginner", "intermediate", "advanced", "expert"][Math.floor(i / 250)];
            const category = ["File Operations", "Text Processing", "System Administration", "Networking", "Security", "Scripting", "DevOps", "Performance Tuning", "Log Analysis", "Package Management"][i % 10];

            this.challenges.push({
                id: `dynamic_${i}`,
                title: `${scenario}: ${task}`,
                description: `Scenario: ${scenario}. Your task is to ${task.toLowerCase()} using appropriate Linux commands.`,
                difficulty: difficulty,
                category: category,
                xp: 30 + (i % 4) * 20,
                solution: this.generateScenarioSolution(task, category),
                hints: [
                    `Consider the context: ${scenario}`,
                    `Focus on ${task.toLowerCase()}`,
                    `Use commands related to ${category.toLowerCase()}`
                ],
                completed: false
            });
        }

        // Add specialized challenge categories
        this.generateSpecializedChallenges();
    }

    generateSpecializedChallenges() {
        // Docker challenges
        const dockerChallenges = [
            { title: "List Docker Containers", solution: "docker ps", xp: 60, description: "Show all running Docker containers" },
            { title: "Pull Docker Image", solution: "docker pull ubuntu", xp: 65, description: "Download Ubuntu image from Docker Hub" },
            { title: "Run Docker Container", solution: "docker run -it ubuntu", xp: 70, description: "Start an interactive Ubuntu container" },
            { title: "Docker Image List", solution: "docker images", xp: 55, description: "List all Docker images on system" },
            { title: "Stop Docker Container", solution: "docker stop container_id", xp: 65, description: "Stop a running container" },
            { title: "Remove Docker Container", solution: "docker rm container_id", xp: 60, description: "Remove a stopped container" },
            { title: "Docker Build Image", solution: "docker build -t myapp .", xp: 85, description: "Build a Docker image from Dockerfile" },
            { title: "Docker Volume Create", solution: "docker volume create myvolume", xp: 70, description: "Create a named Docker volume" },
            { title: "Docker Network List", solution: "docker network ls", xp: 65, description: "List all Docker networks" },
            { title: "Docker Logs", solution: "docker logs container_id", xp: 60, description: "View container logs" }
        ];

        // Git challenges
        const gitChallenges = [
            { title: "Initialize Git Repository", solution: "git init", xp: 50, description: "Initialize a new Git repository" },
            { title: "Check Git Status", solution: "git status", xp: 45, description: "Check repository status" },
            { title: "Add Files to Git", solution: "git add .", xp: 55, description: "Stage all files for commit" },
            { title: "Git Commit", solution: "git commit -m 'message'", xp: 60, description: "Commit staged changes" },
            { title: "Git Push", solution: "git push origin main", xp: 65, description: "Push changes to remote repository" },
            { title: "Git Pull", solution: "git pull", xp: 60, description: "Pull latest changes from remote" },
            { title: "Git Branch Create", solution: "git branch feature-branch", xp: 70, description: "Create a new branch" },
            { title: "Git Checkout", solution: "git checkout branch-name", xp: 65, description: "Switch to a branch" },
            { title: "Git Merge", solution: "git merge feature-branch", xp: 80, description: "Merge a branch" },
            { title: "Git Log", solution: "git log", xp: 55, description: "View commit history" },
            { title: "Git Diff", solution: "git diff", xp: 60, description: "Show changes in working directory" },
            { title: "Git Stash", solution: "git stash", xp: 70, description: "Temporarily save changes" }
        ];

        // Database challenges
        const dbChallenges = [
            { title: "Connect to MySQL", solution: "mysql -u root -p", xp: 80, description: "Connect to MySQL server" },
            { title: "Backup Database", solution: "mysqldump -u root -p database > backup.sql", xp: 90, description: "Create database backup" },
            { title: "Import Database", solution: "mysql -u root -p database < backup.sql", xp: 85, description: "Restore database from backup" },
            { title: "Show Databases", solution: "mysql -e 'SHOW DATABASES;'", xp: 70, description: "List all databases" },
            { title: "PostgreSQL Connect", solution: "psql -U username -d database", xp: 75, description: "Connect to PostgreSQL" },
            { title: "MongoDB Start", solution: "mongod", xp: 70, description: "Start MongoDB server" },
            { title: "Redis Start", solution: "redis-server", xp: 65, description: "Start Redis server" },
            { title: "SQLite Create", solution: "sqlite3 database.db", xp: 60, description: "Create SQLite database" }
        ];

        // Web Server challenges
        const webServerChallenges = [
            { title: "Apache Start", solution: "systemctl start apache2", xp: 70, description: "Start Apache web server" },
            { title: "Nginx Start", solution: "systemctl start nginx", xp: 70, description: "Start Nginx web server" },
            { title: "Check Port 80", solution: "netstat -tulpn | grep :80", xp: 75, description: "Check what's running on port 80" },
            { title: "Apache Config Test", solution: "apache2ctl configtest", xp: 80, description: "Test Apache configuration" },
            { title: "Nginx Config Test", solution: "nginx -t", xp: 80, description: "Test Nginx configuration" },
            { title: "SSL Certificate Check", solution: "openssl x509 -in cert.pem -text -noout", xp: 90, description: "Check SSL certificate details" }
        ];

        // DevOps Tools challenges
        const devOpsChallenges = [
            { title: "Ansible Playbook Run", solution: "ansible-playbook playbook.yml", xp: 95, description: "Execute Ansible playbook" },
            { title: "Terraform Init", solution: "terraform init", xp: 85, description: "Initialize Terraform" },
            { title: "Terraform Plan", solution: "terraform plan", xp: 90, description: "Create Terraform execution plan" },
            { title: "Kubectl Get Pods", solution: "kubectl get pods", xp: 80, description: "List Kubernetes pods" },
            { title: "Helm Install", solution: "helm install release-name chart-name", xp: 85, description: "Install Helm chart" },
            { title: "Jenkins Build", solution: "java -jar jenkins.war", xp: 80, description: "Start Jenkins server" }
        ];

        // System Monitoring challenges
        const monitoringChallenges = [
            { title: "System Load", solution: "uptime", xp: 50, description: "Check system load average" },
            { title: "Memory Usage", solution: "free -h", xp: 55, description: "Check memory usage" },
            { title: "Disk Usage", solution: "df -h", xp: 55, description: "Check disk usage" },
            { title: "CPU Info", solution: "lscpu", xp: 60, description: "Display CPU information" },
            { title: "Running Processes", solution: "ps aux", xp: 65, description: "List all running processes" },
            { title: "Process Tree", solution: "pstree", xp: 70, description: "Display process tree" },
            { title: "Network Statistics", solution: "ss -tuln", xp: 75, description: "Show network connections" },
            { title: "IO Statistics", solution: "iostat", xp: 80, description: "Show I/O statistics" },
            { title: "System Info", solution: "uname -a", xp: 50, description: "Display system information" },
            { title: "Kernel Modules", solution: "lsmod", xp: 75, description: "List loaded kernel modules" }
        ];

        // Security challenges
        const securityChallenges = [
            { title: "Check Failed Logins", solution: "grep 'Failed password' /var/log/auth.log", xp: 85, description: "Find failed login attempts" },
            { title: "Active SSH Sessions", solution: "who", xp: 60, description: "Show active user sessions" },
            { title: "Firewall Status", solution: "ufw status", xp: 70, description: "Check firewall status" },
            { title: "Open Ports", solution: "nmap localhost", xp: 80, description: "Scan for open ports" },
            { title: "File Permissions Audit", solution: "find /etc -perm -002", xp: 90, description: "Find world-writable files" },
            { title: "SUID Files", solution: "find / -perm -4000", xp: 95, description: "Find SUID executables" },
            { title: "Check Root Access", solution: "sudo -l", xp: 75, description: "List sudo privileges" },
            { title: "SELinux Status", solution: "getenforce", xp: 80, description: "Check SELinux status" }
        ];

        // Add all specialized challenges
        const allSpecializedChallenges = [
            ...dockerChallenges.map(c => ({...c, category: "Docker"})),
            ...gitChallenges.map(c => ({...c, category: "Git"})),
            ...dbChallenges.map(c => ({...c, category: "Database"})),
            ...webServerChallenges.map(c => ({...c, category: "Web Servers"})),
            ...devOpsChallenges.map(c => ({...c, category: "DevOps Tools"})),
            ...monitoringChallenges.map(c => ({...c, category: "System Monitoring"})),
            ...securityChallenges.map(c => ({...c, category: "Security"}))
        ];

        allSpecializedChallenges.forEach((challenge, index) => {
            this.challenges.push({
                ...challenge,
                id: `specialized_${index}`,
                difficulty: challenge.xp > 80 ? "expert" : "advanced",
                description: challenge.description || `Execute: ${challenge.title}`,
                hints: challenge.hints || [`Use appropriate ${challenge.title.split(' ')[0].toLowerCase()} command`],
                completed: false
            });
        });
    }

    generateScenarioSolution(task, category) {
        const solutionMap = {
            "Find configuration files": "find /etc -name '*.conf'",
            "Check service status": "systemctl status",
            "Monitor resource usage": "top",
            "Analyze log patterns": "grep -i error /var/log/syslog",
            "Verify file permissions": "ls -la",
            "Test network connectivity": "ping -c 3 google.com",
            "Create backup scripts": "tar -czf backup.tar.gz /home",
            "Search for error messages": "grep -r 'error' /var/log/",
            "Track user activity": "who",
            "Optimize system performance": "ps aux | sort -k3 -n",
            "Secure sensitive files": "chmod 600 sensitive_file",
            "Automate routine tasks": "crontab -e"
        };

        return solutionMap[task] || "echo 'Task completed'";
    }

    loadChallenges() {
        const challengesGrid = document.getElementById('challenges-grid');
        
        // Only show first 50 challenges for better performance
        const displayChallenges = this.challenges.slice(0, 50);
        
        challengesGrid.innerHTML = displayChallenges.map(challenge => `
            <div class="challenge-card ${challenge.completed ? 'completed' : ''}" data-challenge-id="${challenge.id}">
                <div class="challenge-header">
                    <div class="challenge-title">${challenge.title}</div>
                    <div class="challenge-difficulty difficulty-${challenge.difficulty}">${challenge.difficulty}</div>
                </div>
                <div class="challenge-description">${challenge.description}</div>
                <div class="challenge-meta">
                    <div class="challenge-category">${challenge.category}</div>
                    <div class="challenge-xp">+${challenge.xp} XP</div>
                </div>
            </div>
        `).join('');

        // Add event listeners to challenge cards
        document.querySelectorAll('.challenge-card').forEach(card => {
            card.addEventListener('click', () => {
                const challengeId = card.dataset.challengeId;
                this.openChallenge(challengeId);
            });
        });

        // Update challenge stats
        this.updateChallengeStats();
    }

    updateChallengeStats() {
        const totalChallenges = this.challenges.length;
        const completedChallenges = this.challenges.filter(c => c.completed).length;
        const successRate = totalChallenges > 0 ? Math.round((completedChallenges / totalChallenges) * 100) : 0;

        document.getElementById('total-challenges').textContent = totalChallenges;
        document.getElementById('completed-challenges').textContent = completedChallenges;
        document.getElementById('success-rate').textContent = successRate + '%';
    }

    filterChallenges(filter) {
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const filterBtn = document.querySelector(`[data-filter="${filter}"]`);
        if (filterBtn) {
            filterBtn.classList.add('active');
        }

        // Filter challenges
        const challengeCards = document.querySelectorAll('.challenge-card');
        challengeCards.forEach(card => {
            const challengeId = card.dataset.challengeId;
            const challenge = this.challenges.find(c => c.id === challengeId);

            if (filter === 'all' || challenge.difficulty === filter) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    searchChallenges(searchTerm) {
        const challengeCards = document.querySelectorAll('.challenge-card');
        const term = searchTerm.toLowerCase();

        challengeCards.forEach(card => {
            const challengeId = card.dataset.challengeId;
            const challenge = this.challenges.find(c => c.id === challengeId);
            
            const matchesSearch = !term || 
                challenge.title.toLowerCase().includes(term) ||
                challenge.description.toLowerCase().includes(term) ||
                challenge.category.toLowerCase().includes(term);

            card.style.display = matchesSearch ? 'block' : 'none';
        });
    }

    generateRandomChallenge() {
        const difficulties = ['beginner', 'intermediate', 'advanced', 'expert'];
        const categories = ['File Operations', 'Text Processing', 'System Administration', 'Networking', 'Security', 'Scripting'];
        
        const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        
        const newChallenge = {
            id: `random_${Date.now()}`,
            title: `Random ${randomCategory} Challenge`,
            description: `Complete a ${randomDifficulty} level ${randomCategory.toLowerCase()} task.`,
            difficulty: randomDifficulty,
            category: randomCategory,
            xp: 25 + Math.floor(Math.random() * 75),
            solution: 'echo "Challenge completed"',
            hints: [`This is a ${randomDifficulty} level challenge`, `Focus on ${randomCategory.toLowerCase()} commands`],
            completed: false
        };

        this.challenges.unshift(newChallenge);
        this.loadChallenges();
        this.showNotification('New challenge generated!', 'success');
    }

    loadMoreChallenges() {
        // This could load more challenges from a server or generate more locally
        const currentCount = document.querySelectorAll('.challenge-card').length;
        const remainingChallenges = this.challenges.slice(currentCount, currentCount + 20);
        
        if (remainingChallenges.length === 0) {
            this.showNotification('No more challenges to load', 'info');
            return;
        }

        const challengesGrid = document.getElementById('challenges-grid');
        const newChallengeCards = remainingChallenges.map(challenge => `
            <div class="challenge-card ${challenge.completed ? 'completed' : ''}" data-challenge-id="${challenge.id}">
                <div class="challenge-header">
                    <div class="challenge-title">${challenge.title}</div>
                    <div class="challenge-difficulty difficulty-${challenge.difficulty}">${challenge.difficulty}</div>
                </div>
                <div class="challenge-description">${challenge.description}</div>
                <div class="challenge-meta">
                    <div class="challenge-category">${challenge.category}</div>
                    <div class="challenge-xp">+${challenge.xp} XP</div>
                </div>
            </div>
        `).join('');

        challengesGrid.innerHTML += newChallengeCards;

        // Add event listeners to new cards
        document.querySelectorAll('.challenge-card').forEach(card => {
            card.removeEventListener('click', this.handleChallengeClick);
            card.addEventListener('click', this.handleChallengeClick.bind(this));
        });

        this.showNotification(`Loaded ${remainingChallenges.length} more challenges`, 'success');
    }

    handleChallengeClick(event) {
        const challengeId = event.currentTarget.dataset.challengeId;
        this.openChallenge(challengeId);
    }

    openChallenge(challengeId) {
        const challenge = this.challenges.find(c => c.id === challengeId);
        if (!challenge) return;

        this.currentChallenge = challenge;

        document.getElementById('challenge-title').textContent = challenge.title;
        document.getElementById('challenge-description').innerHTML = `
            <p><strong>Task:</strong> ${challenge.description}</p>
            <p><strong>Category:</strong> ${challenge.category}</p>
            <p><strong>Difficulty:</strong> ${challenge.difficulty}</p>
            <p><strong>Reward:</strong> +${challenge.xp} XP</p>
            ${challenge.hints ? `<p><strong>Hints:</strong><br>${challenge.hints.map(hint => `• ${hint}`).join('<br>')}</p>` : ''}
        `;

        document.getElementById('challenge-output').innerHTML = '<div class="welcome-message">Challenge Terminal - Enter your solution below:</div>';
        document.getElementById('challenge-modal').classList.remove('hidden');

        // Focus on challenge input
        setTimeout(() => {
            document.getElementById('challenge-input').focus();
        }, 100);

        // Setup challenge input handler
        const challengeInput = document.getElementById('challenge-input');
        challengeInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                this.processChallengeCommand(e.target.value.trim());
                e.target.value = '';
            }
        };
    }

    processChallengeCommand(command) {
        if (!this.currentChallenge) return;

        const output = document.getElementById('challenge-output');

        // Add command to output
        const commandDiv = document.createElement('div');
        commandDiv.innerHTML = `<span class="command-prompt">user@challenge:~$</span> <span class="command-text">${command}</span>`;
        output.appendChild(commandDiv);

        // Check solution
        const solution = this.currentChallenge.solution;
        let isCorrect = false;

        if (Array.isArray(solution)) {
            // Multi-step challenge - check if command is one of the solutions
            isCorrect = solution.includes(command);
        } else {
            isCorrect = command.toLowerCase() === solution.toLowerCase();
        }

        if (isCorrect) {
            const successDiv = document.createElement('div');
            successDiv.className = 'command-success';
            successDiv.textContent = `Correct! Well done! You earned ${this.currentChallenge.xp} XP.`;
            output.appendChild(successDiv);

            // Mark challenge as completed
            this.completeChallenge(this.currentChallenge.id);

            setTimeout(() => {
                this.closeChallenge();
            }, 2000);
        } else {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'command-error';
            errorDiv.textContent = 'Not quite right. Try again or check the hints!';
            output.appendChild(errorDiv);
        }

        output.scrollTop = output.scrollHeight;
    }

    completeChallenge(challengeId) {
        const challenge = this.challenges.find(c => c.id === challengeId);
        if (challenge && !challenge.completed) {
            challenge.completed = true;
            this.user.xp += challenge.xp;

            // Update level
            const newLevel = Math.floor(this.user.xp / 100) + 1;
            if (newLevel > this.user.level) {
                this.user.level = newLevel;
                this.showNotification(`Level Up! You are now level ${newLevel}!`, 'success');
            }

            this.updateUserDisplay();
            this.checkAchievements();
            this.showNotification(`Challenge completed! +${challenge.xp} XP`, 'success');
        }
    }

    closeChallenge() {
        document.getElementById('challenge-modal').classList.add('hidden');
        this.currentChallenge = null;
    }

    // Achievement System
    initializeAchievements() {
        this.achievementDefinitions = [
            // Beginner achievements
            {
                id: 'first_command',
                name: 'First Steps',
                description: 'Execute your first command',
                icon: 'fas fa-baby',
                condition: () => this.commandHistory.length >= 1
            },
            {
                id: 'explorer',
                name: 'Directory Explorer',
                description: 'Use the cd command 5 times',
                icon: 'fas fa-compass',
                condition: () => this.commandHistory.filter(cmd => cmd.startsWith('cd')).length >= 5
            },
            {
                id: 'file_reader',
                name: 'File Reader',
                description: 'Read 3 files with cat command',
                icon: 'fas fa-book-open',
                condition: () => this.commandHistory.filter(cmd => cmd.startsWith('cat')).length >= 3
            },
            
            // Intermediate achievements
            {
                id: 'command_master',
                name: 'Command Master',
                description: 'Learn 15 different commands',
                icon: 'fas fa-graduation-cap',
                condition: () => this.user.commandsLearned >= 15
            },
            {
                id: 'file_manipulator',
                name: 'File Manipulator',
                description: 'Create, copy, and move files',
                icon: 'fas fa-folder-open',
                condition: () => this.user.skills['file-ops'] >= 100
            },
            {
                id: 'text_wizard',
                name: 'Text Wizard',
                description: 'Master text processing with grep and friends',
                icon: 'fas fa-magic',
                condition: () => this.user.skills['text-proc'] >= 150
            },
            {
                id: 'sys_admin_rookie',
                name: 'System Admin Rookie',
                description: 'Learn basic system administration',
                icon: 'fas fa-server',
                condition: () => this.user.skills['sys-admin'] >= 100
            },
            
            // Challenge achievements
            {
                id: 'challenge_starter',
                name: 'Challenge Starter',
                description: 'Complete 3 beginner challenges',
                icon: 'fas fa-play',
                condition: () => this.challenges.filter(c => c.completed && c.difficulty === 'beginner').length >= 3
            },
            {
                id: 'challenge_apprentice',
                name: 'Challenge Apprentice',
                description: 'Complete 10 beginner challenges',
                icon: 'fas fa-star',
                condition: () => this.challenges.filter(c => c.completed && c.difficulty === 'beginner').length >= 10
            },
            {
                id: 'challenge_intermediate',
                name: 'Intermediate Warrior',
                description: 'Complete 5 intermediate challenges',
                icon: 'fas fa-star-half-alt',
                condition: () => this.challenges.filter(c => c.completed && c.difficulty === 'intermediate').length >= 5
            },
            {
                id: 'challenge_advanced',
                name: 'Advanced Conqueror',
                description: 'Complete 3 advanced challenges',
                icon: 'fas fa-crown',
                condition: () => this.challenges.filter(c => c.completed && c.difficulty === 'advanced').length >= 3
            },
            {
                id: 'challenge_expert',
                name: 'Expert Destroyer',
                description: 'Complete 1 expert challenge',
                icon: 'fas fa-dragon',
                condition: () => this.challenges.filter(c => c.completed && c.difficulty === 'expert').length >= 1
            },
            
            // XP and level achievements
            {
                id: 'xp_hunter',
                name: 'XP Hunter',
                description: 'Earn 500 XP',
                icon: 'fas fa-coins',
                condition: () => this.user.xp >= 500
            },
            {
                id: 'xp_collector',
                name: 'XP Collector',
                description: 'Earn 1000 XP',
                icon: 'fas fa-gem',
                condition: () => this.user.xp >= 1000
            },
            {
                id: 'xp_master',
                name: 'XP Master',
                description: 'Earn 2500 XP',
                icon: 'fas fa-diamond',
                condition: () => this.user.xp >= 2500
            },
            {
                id: 'level_three',
                name: 'Level 3 Achiever',
                description: 'Reach level 3',
                icon: 'fas fa-medal',
                condition: () => this.user.level >= 3
            },
            {
                id: 'level_five',
                name: 'Level 5 Hero',
                description: 'Reach level 5',
                icon: 'fas fa-trophy',
                condition: () => this.user.level >= 5
            },
            {
                id: 'level_ten',
                name: 'Level 10 Legend',
                description: 'Reach level 10',
                icon: 'fas fa-crown',
                condition: () => this.user.level >= 10
            },
            
            // Streak achievements
            {
                id: 'streak_three',
                name: 'Three Day Streak',
                description: 'Maintain a 3-day learning streak',
                icon: 'fas fa-fire',
                condition: () => this.user.streak >= 3
            },
            {
                id: 'streak_week',
                name: 'Week Warrior',
                description: 'Maintain a 7-day learning streak',
                icon: 'fas fa-fire-flame-curved',
                condition: () => this.user.streak >= 7
            },
            {
                id: 'streak_month',
                name: 'Monthly Master',
                description: 'Maintain a 30-day learning streak',
                icon: 'fas fa-fire-flame-simple',
                condition: () => this.user.streak >= 30
            },
            
            // Special achievements
            {
                id: 'network_ninja',
                name: 'Network Ninja',
                description: 'Master networking commands',
                icon: 'fas fa-network-wired',
                condition: () => this.user.skills['networking'] >= 100
            },
            {
                id: 'security_specialist',
                name: 'Security Specialist',
                description: 'Learn security and permissions',
                icon: 'fas fa-shield-alt',
                condition: () => this.user.skills['security'] >= 100
            },
            {
                id: 'script_master',
                name: 'Script Master',
                description: 'Advanced scripting skills',
                icon: 'fas fa-code',
                condition: () => this.user.skills['scripting'] >= 150
            },
            {
                id: 'linux_guru',
                name: 'Linux Guru',
                description: 'Complete 50 challenges total',
                icon: 'fas fa-user-ninja',
                condition: () => this.challenges.filter(c => c.completed).length >= 50
            },
            {
                id: 'terminal_master',
                name: 'Terminal Master',
                description: 'Execute 100 commands',
                icon: 'fas fa-terminal',
                condition: () => this.commandHistory.length >= 100
            }
        ];
    }

    checkAchievements() {
        this.achievementDefinitions.forEach(achievement => {
            if (!this.achievements.includes(achievement.id) && achievement.condition()) {
                this.unlockAchievement(achievement.id);
            }
        });
    }

    unlockAchievement(achievementId) {
        this.achievements.push(achievementId);
        const achievement = this.achievementDefinitions.find(a => a.id === achievementId);

        if (achievement) {
            this.showNotification(`Achievement Unlocked: ${achievement.name}!`, 'success');

            // Award bonus XP
            this.user.xp += 50;
            this.updateUserDisplay();
        }
    }

    loadAchievements() {
        const achievementsGrid = document.getElementById('achievements-grid');
        achievementsGrid.innerHTML = this.achievementDefinitions.map(achievement => {
            const isUnlocked = this.achievements.includes(achievement.id);
            return `
                <div class="achievement-card ${isUnlocked ? 'unlocked' : ''}">
                    <div class="achievement-icon">
                        <i class="${achievement.icon}"></i>
                    </div>
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-description">${achievement.description}</div>
                </div>
            `;
        }).join('');
    }

    // Leaderboard System
    updateLeaderboard() {
        // Generate mock leaderboard data
        const mockUsers = [
            { name: 'LinuxNinja', level: 15, xp: 2450, streak: 21 },
            { name: 'TerminalMaster', level: 12, xp: 1890, streak: 15 },
            { name: 'CommandGuru', level: 11, xp: 1654, streak: 8 },
            { name: 'BashExpert', level: 10, xp: 1543, streak: 12 },
            { name: 'ShellWizard', level: 9, xp: 1321, streak: 6 },
            { name: 'You', level: this.user.level, xp: this.user.xp, streak: this.user.streak }
        ];

        // Sort by XP
        mockUsers.sort((a, b) => b.xp - a.xp);

        const leaderboardList = document.getElementById('leaderboard-list');
        leaderboardList.innerHTML = mockUsers.map((user, index) => `
            <div class="leaderboard-entry ${user.name === 'You' ? 'current-user' : ''}">
                <div class="entry-rank ${index < 3 ? 'top-3' : ''}">#${index + 1}</div>
                <div class="entry-user">${user.name}</div>
                <div class="entry-level">${user.level}</div>
                <div class="entry-xp">${user.xp}</div>
                <div class="entry-streak">${user.streak}</div>
            </div>
        `).join('');
    }

    // AI Assistant
    toggleAIAssistant() {
        const assistant = document.getElementById('ai-assistant');
        const toggleBtn = document.getElementById('toggle-assistant');

        this.aiAssistantOpen = !this.aiAssistantOpen;

        if (this.aiAssistantOpen) {
            assistant.classList.remove('collapsed');
            toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
        } else {
            assistant.classList.add('collapsed');
            toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
        }
    }

    sendAIMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message) return;

        this.addChatMessage(message, 'user');
        input.value = '';

        // Simulate AI response
        setTimeout(() => {
            const response = this.generateAIResponse(message);
            this.addChatMessage(response, 'assistant');
        }, 1000);
    }

    addChatMessage(message, sender) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `${sender}-message`;

        const avatar = sender === 'assistant' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">${message}</div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    generateAIResponse(message) {
        const lowerMessage = message.toLowerCase();

        // Command-specific help
        if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
            if (lowerMessage.includes('ls')) {
                return "📁 The 'ls' command lists directory contents.\n\nCommon options:\n• ls -l (detailed list)\n• ls -a (show hidden files)\n• ls -la (combine both)\n• ls -R (recursive)\n\nTry: ls -la to see everything!";
            } else if (lowerMessage.includes('cd')) {
                return "🚀 The 'cd' command changes directories.\n\nExamples:\n• cd ~ (go home)\n• cd .. (go up one level)\n• cd /path/to/directory\n• cd - (go to previous directory)\n\nPro tip: Use Tab completion for paths!";
            } else if (lowerMessage.includes('grep')) {
                return "🔍 'grep' searches for text patterns in files.\n\nUseful flags:\n• grep -i (case insensitive)\n• grep -n (show line numbers)\n• grep -r (recursive search)\n• grep -c (count matches)\n\nExample: grep -i 'error' log.txt";
            } else if (lowerMessage.includes('find')) {
                return "🎯 'find' locates files and directories.\n\nCommon patterns:\n• find . -name '*.txt'\n• find /home -type f -size +1M\n• find . -mtime -7 (modified last 7 days)\n\nPowerful for system administration!";
            } else if (lowerMessage.includes('chmod')) {
                return "🔐 'chmod' changes file permissions.\n\nNumeric notation:\n• 755 = rwxr-xr-x\n• 644 = rw-r--r--\n• 600 = rw-------\n\nSymbolic: chmod u+x file (add execute for user)";
            } else if (lowerMessage.includes('pipe') || lowerMessage.includes('|')) {
                return "🔄 Pipes (|) connect commands together!\n\nExamples:\n• ls -la | grep '.txt'\n• cat file.txt | sort | uniq\n• ps aux | grep python\n\nOutput of first command becomes input of second!";
            } else {
                return "💡 I can help with specific Linux commands! Try asking about:\n• File operations (ls, cd, cp, mv)\n• Text processing (grep, sed, awk)\n• System info (ps, top, df)\n• Permissions (chmod, chown)\n• Networking (ping, netstat)\n\nWhat would you like to explore?";
            }
        } 
        
        // Learning path guidance
        else if (lowerMessage.includes('learn') || lowerMessage.includes('start')) {
            return "🎓 Great choice! Here's your learning path:\n\n1️⃣ Start with navigation: pwd, ls, cd\n2️⃣ File operations: cat, touch, cp, mv, rm\n3️⃣ Text processing: grep, sort, head, tail\n4️⃣ System administration: ps, top, df, du\n5️⃣ Advanced: pipes, redirects, scripting\n\nTry some beginner challenges to practice!";
        }
        
        // Challenge help
        else if (lowerMessage.includes('challenge') || lowerMessage.includes('stuck')) {
            const completedChallenges = this.challenges.filter(c => c.completed).length;
            const totalChallenges = this.challenges.length;
            return `🏆 You've completed ${completedChallenges}/${totalChallenges} challenges!\n\nStuck on a challenge? Try:\n• Read the hints carefully\n• Break down the task into steps\n• Use 'man command' for detailed help\n• Practice similar commands first\n\nRemember: every expert was once a beginner!`;
        }
        
        // Performance and tips
        else if (lowerMessage.includes('tip') || lowerMessage.includes('advice') || lowerMessage.includes('improve')) {
            const tips = [
                "⚡ Use Tab completion - it's faster and prevents typos! Start typing and press Tab.",
                "📚 The 'man' command is your best friend: 'man ls' shows complete documentation.",
                "🔥 Practice daily! Even 10 minutes will significantly boost your Linux skills.",
                "🧪 Don't fear experimentation! Use a test directory to try new commands safely.",
                "⌨️ Learn shortcuts: Ctrl+C (cancel), Ctrl+L (clear), Ctrl+R (search history).",
                "🔄 Master pipes! Chain commands like: ls -la | grep '.txt' | wc -l",
                "📖 Read error messages carefully - they often tell you exactly what's wrong.",
                "🎯 Use aliases for common commands: alias ll='ls -la'",
                "💾 Learn redirects: > (output to file), >> (append), < (input from file)",
                "🔍 Use history command to see and rerun previous commands."
            ];
            return tips[Math.floor(Math.random() * tips.length)];
        }
        
        // Progress and motivation
        else if (lowerMessage.includes('progress') || lowerMessage.includes('level')) {
            return `🌟 Your Linux Arsenal Progress:\n\n• Level: ${this.user.level}\n• XP: ${this.user.xp}\n• Commands Mastered: ${this.user.commandsLearned}\n• Current Streak: ${this.user.streak} days\n\nKeep practicing to unlock more achievements! Try tackling some intermediate challenges next.`;
        }
        
        // Default helpful responses
        else {
            const responses = [
                "🤖 I'm here to help you master Linux! Ask me about specific commands, learning paths, or challenge strategies.",
                "💭 What Linux concept would you like to explore? I can explain commands, provide examples, or suggest practice exercises.",
                "🎯 Need help with a specific task? Describe what you're trying to accomplish and I'll guide you through it!",
                "📝 Try asking: 'How do I...?', 'What does [command] do?', or 'Give me tips for...'",
                "🚀 Ready to level up? Ask me about advanced techniques, best practices, or challenge strategies!"
            ];
            return responses[Math.floor(Math.random() * responses.length)];
        }
    }

    // Notification System
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    // Auto-save and data persistence
    saveProgress() {
        const data = {
            user: this.user,
            achievements: this.achievements,
            commandHistory: this.commandHistory.slice(-50), // Keep last 50 commands
            challenges: this.challenges.filter(c => c.completed).map(c => ({ id: c.id, completed: true }))
        };

        localStorage.setItem('linuxArsenalProgress', JSON.stringify(data));
    }

    loadProgress() {
        const saved = localStorage.getItem('linuxArsenalProgress');
        if (saved) {
            const data = JSON.parse(saved);
            this.user = { ...this.user, ...data.user };
            this.achievements = data.achievements || [];
            this.commandHistory = data.commandHistory || [];

            // Mark completed challenges
            if (data.challenges) {
                data.challenges.forEach(savedChallenge => {
                    const challenge = this.challenges.find(c => c.id === savedChallenge.id);
                    if (challenge) {
                        challenge.completed = true;
                    }
                });
            }
        }
    }
}

// Initialize the application when the page loads
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
