// Linux Arsenal - manual pages, --help text, tldr examples and documentation commands
(function () {
    'use strict';
    const LA = (globalThis.LA = globalThis.LA || {});
    const U = LA.util;

    // Format: name: [summary, category, synopsis, description, options, examples]
    // options / examples are newline separated "left :: right" lines.
    const RAW = {
        // ---------------- navigation & files
        ls: ['list directory contents', 'Files & Navigation', 'ls [OPTION]... [FILE]...', 'List information about the FILEs (the current directory by default). Entries are sorted alphabetically unless -t, -S or -X is given. When writing to a terminal, names are colorized and arranged in columns.',
            `-a, --all :: do not ignore entries starting with .
-A, --almost-all :: like -a but do not list . and ..
-l :: use a long listing format (permissions, links, owner, group, size, date)
-h, --human-readable :: with -l, print sizes like 1K 234M 2G
-R, --recursive :: list subdirectories recursively
-t :: sort by modification time, newest first
-S :: sort by file size, largest first
-r, --reverse :: reverse order while sorting
-1 :: list one file per line
-d, --directory :: list directories themselves, not their contents
-F, --classify :: append indicator (one of */=>@|) to entries
-i, --inode :: print the index number of each file
--color[=WHEN] :: colorize the output; WHEN can be always, auto or never`,
            `ls :: list files in the current directory
ls -la :: long listing including hidden files
ls -lh /var/log :: show sizes in human-readable units
ls -lt :: newest files first
ls -lS :: biggest files first
ls -R projects :: list a directory tree recursively
ls -d */ :: list only directories
ls *.txt :: list files matching a glob`],
        cd: ['change the shell working directory', 'Files & Navigation', 'cd [DIR]', 'Change the current directory to DIR. The default DIR is the value of the HOME shell variable. "cd -" switches to the previous directory ($OLDPWD). ".." is the parent directory.',
            `- :: go to the previous directory
~ :: your home directory
.. :: the parent directory`,
            `cd :: go to your home directory
cd /etc :: go to an absolute path
cd .. :: go up one level
cd ../.. :: go up two levels
cd - :: jump back to the previous directory
cd ~/documents :: path relative to home`],
        pwd: ['print name of current/working directory', 'Files & Navigation', 'pwd [-LP]', 'Print the full filename of the current working directory.', `-P :: print the physical directory, without symbolic links`, `pwd :: show where you are`],
        mkdir: ['make directories', 'Files & Navigation', 'mkdir [OPTION]... DIRECTORY...', 'Create the DIRECTORY(ies), if they do not already exist.',
            `-p, --parents :: no error if existing, make parent directories as needed
-m, --mode=MODE :: set file mode (as in chmod)
-v, --verbose :: print a message for each created directory`,
            `mkdir projects :: create one directory
mkdir -p a/b/c :: create nested directories
mkdir -m 700 private :: create a private directory
mkdir dir1 dir2 dir3 :: create several directories
mkdir -p backup/{daily,weekly} :: brace expansion creates two`],
        rmdir: ['remove empty directories', 'Files & Navigation', 'rmdir [OPTION]... DIRECTORY...', 'Remove the DIRECTORY(ies), if they are empty.', `-p, --parents :: remove DIRECTORY and its ancestors
-v, --verbose :: output a diagnostic for every directory processed`, `rmdir old :: remove an empty directory
rmdir -p a/b/c :: remove c, then b, then a`],
        touch: ['change file timestamps (or create empty files)', 'Files & Navigation', 'touch [OPTION]... FILE...', 'Update the modification time of each FILE to the current time. A FILE argument that does not exist is created empty.',
            `-c, --no-create :: do not create any files
-d, --date=STRING :: use STRING instead of current time
-t STAMP :: use [[CC]YY]MMDDhhmm[.ss] instead of current time
-r, --reference=FILE :: use this file's times`, `touch notes.txt :: create an empty file
touch a.txt b.txt c.txt :: create several files
touch -d "2 days ago" old.log :: backdate a file
touch file{1..5}.txt :: create file1.txt ... file5.txt`],
        cp: ['copy files and directories', 'Files & Navigation', 'cp [OPTION]... SOURCE... DEST', 'Copy SOURCE to DEST, or multiple SOURCE(s) to DIRECTORY.',
            `-r, -R, --recursive :: copy directories recursively
-a, --archive :: copy recursively, preserving attributes
-i, --interactive :: prompt before overwrite
-n, --no-clobber :: do not overwrite an existing file
-u, --update :: copy only when the SOURCE is newer
-v, --verbose :: explain what is being done
-p :: preserve mode, ownership and timestamps`,
            `cp file.txt backup.txt :: copy a file
cp file.txt /tmp/ :: copy into a directory
cp -r projects projects.bak :: copy a whole directory
cp *.log logs/ :: copy all .log files
cp -v a.txt b.txt :: show what was copied`],
        mv: ['move (rename) files', 'Files & Navigation', 'mv [OPTION]... SOURCE... DEST', 'Rename SOURCE to DEST, or move SOURCE(s) to DIRECTORY.',
            `-i, --interactive :: prompt before overwrite
-n, --no-clobber :: do not overwrite an existing file
-u, --update :: move only when the SOURCE is newer
-v, --verbose :: explain what is being done`,
            `mv old.txt new.txt :: rename a file
mv report.pdf ~/documents/ :: move a file into a directory
mv *.jpg pictures/ :: move many files
mv -n a b :: never overwrite b`],
        rm: ['remove files or directories', 'Files & Navigation', 'rm [OPTION]... [FILE]...', 'Remove (unlink) the FILE(s). By default, rm does not remove directories. Removed files cannot be recovered - there is no trash can on the command line!',
            `-f, --force :: ignore nonexistent files, never prompt
-i :: prompt before every removal
-r, -R, --recursive :: remove directories and their contents recursively
-d, --dir :: remove empty directories
-v, --verbose :: explain what is being done
--no-preserve-root :: do not treat '/' specially`,
            `rm file.txt :: delete a file
rm -r old_project :: delete a directory and everything in it
rm -f *.tmp :: delete temp files, no errors if none
rm -i important.txt :: ask before deleting
rm -rv build/ :: show each file being removed`],
        ln: ['make links between files', 'Files & Navigation', 'ln [OPTION]... TARGET LINK_NAME', 'Create a link to TARGET with the name LINK_NAME. Hard links share the same data; symbolic links (-s) point to a path.',
            `-s, --symbolic :: make symbolic links instead of hard links
-f, --force :: remove existing destination files
-v, --verbose :: print name of each linked file`,
            `ln -s /var/log logs :: create a symlink named logs
ln -s ../config.ini current.ini :: relative symlink
ln data.txt hardlink.txt :: create a hard link
ln -sf new_target link :: repoint an existing link`],
        cat: ['concatenate files and print on the standard output', 'Text Processing', 'cat [OPTION]... [FILE]...', 'Concatenate FILE(s) to standard output. With no FILE, or when FILE is -, read standard input.',
            `-n, --number :: number all output lines
-b, --number-nonblank :: number nonempty output lines
-s, --squeeze-blank :: suppress repeated empty output lines
-E, --show-ends :: display $ at end of each line
-T, --show-tabs :: display TAB characters as ^I
-A, --show-all :: show all non-printing characters`,
            `cat notes.txt :: print a file
cat -n script.sh :: print with line numbers
cat a.txt b.txt > both.txt :: join two files
cat > new.txt :: type into a file (from stdin)
cat <<EOF > file.txt :: write several lines with a here-document`],
        tac: ['concatenate and print files in reverse', 'Text Processing', 'tac [FILE]...', 'Write each FILE to standard output, last line first.', '', `tac log.txt :: newest lines first`],
        stat: ['display file or file system status', 'Files & Navigation', 'stat [OPTION]... FILE...', 'Display detailed status information: size, blocks, inode, permissions, owner and timestamps.',
            `-c, --format=FORMAT :: use the specified FORMAT, e.g. %n %s %a %A %U %G %y
-L, --dereference :: follow links`, `stat notes.txt :: full status
stat -c '%a %n' * :: octal permissions of every file
stat -c %s file :: size in bytes`],
        file: ['determine file type', 'Files & Navigation', 'file [OPTION]... FILE...', 'Tests each argument in an attempt to classify it (text, script, archive, image, directory...).', `-b, --brief :: do not prepend filenames
-i, --mime :: output mime type strings`, `file * :: identify every file
file -i data.json :: show the MIME type`],
        tree: ['list contents of directories in a tree-like format', 'Files & Navigation', 'tree [OPTION]... [DIRECTORY]...', 'Recursively list directories as an indented tree.',
            `-a :: show hidden files
-d :: list directories only
-L LEVEL :: descend only LEVEL directories deep
-f :: print the full path prefix
-F :: append a / for directories, * for executables
-h :: print sizes in human readable form
-p :: print permissions
-I PATTERN :: do not list files matching PATTERN
--dirsfirst :: list directories before files`,
            `tree :: tree of the current directory
tree -L 2 / :: two levels of the root filesystem
tree -d projects :: only directories
tree -a ~ :: include hidden files`],
        find: ['search for files in a directory hierarchy', 'Files & Navigation', 'find [PATH...] [EXPRESSION]', 'Walk the file tree rooted at each PATH, evaluating the EXPRESSION for every file. Tests can be combined with -a (and, default), -o (or) and ! (not).',
            `-name PATTERN :: base name matches shell PATTERN (quote it!)
-iname PATTERN :: like -name but case insensitive
-type f|d|l :: regular file, directory or symbolic link
-size [+-]N[ckMG] :: file uses more/less/exactly N units
-mtime [+-]N :: modified N*24 hours ago
-mmin [+-]N :: modified N minutes ago
-user NAME :: owned by user NAME
-perm MODE :: permission bits are exactly MODE (-MODE: all of, /MODE: any of)
-empty :: empty file or directory
-maxdepth N :: descend at most N levels
-exec CMD {} \\; :: run CMD on each match ({} is replaced by the name)
-exec CMD {} + :: run CMD once with all matches
-delete :: delete matching files
-print :: print the name (default action)`,
            `find . -name "*.txt" :: all .txt files below here
find /var/log -type f -size +1k :: log files bigger than 1KiB
find ~ -mtime -1 :: files changed in the last day
find . -type d -empty :: empty directories
find . -name "*.tmp" -delete :: delete temp files
find /etc -name "*.conf" -exec grep -l nginx {} \\; :: config files that mention nginx
find / -perm -4000 -type f 2>/dev/null :: SUID programs
find . -maxdepth 1 -type f | wc -l :: count files here`],
        locate: ['find files by name (in a database)', 'Files & Navigation', 'locate [OPTION]... PATTERN...', 'Search an index of the filesystem for file names containing PATTERN.', `-i :: ignore case`, `locate nginx.conf :: where is nginx.conf?`],
        du: ['estimate file space usage', 'Files & Navigation', 'du [OPTION]... [FILE]...', 'Summarize disk usage of each FILE, recursively for directories.',
            `-h, --human-readable :: print sizes like 1K 234M 2G
-s, --summarize :: display only a total for each argument
-a, --all :: write counts for all files, not just directories
-c, --total :: produce a grand total
-d, --max-depth=N :: print totals only N levels deep`,
            `du -sh * :: size of each item here
du -h --max-depth=1 /var :: sizes one level deep
du -ah projects | sort -h :: everything sorted by size`],
        df: ['report file system disk space usage', 'System Information', 'df [OPTION]... [FILE]...', 'Show available and used disk space on mounted file systems.', `-h, --human-readable :: print sizes in powers of 1024
-T, --print-type :: print file system type
-i, --inodes :: list inode information`, `df -h :: disk space in readable units
df -hT :: include the filesystem type`],
        chmod: ['change file mode bits', 'Permissions', 'chmod [OPTION]... MODE[,MODE]... FILE...', 'Change the permissions of each FILE. MODE is symbolic ([ugoa][+-=][rwxXst]) or octal (e.g. 755). Read=4, write=2, execute=1; digits are owner, group, others.',
            `-R, --recursive :: change files and directories recursively
-v, --verbose :: output a diagnostic for every file processed
-c, --changes :: like verbose but report only when a change is made`,
            `chmod +x script.sh :: make a script executable
chmod 644 notes.txt :: rw-r--r--
chmod 755 bin/ :: rwxr-xr-x
chmod 600 ~/.ssh/id_ed25519 :: private key: owner read/write only
chmod u+x,g-w file :: symbolic changes
chmod -R go-rwx private/ :: remove group/other access recursively`],
        chown: ['change file owner and group', 'Permissions', 'chown [OPTION]... [OWNER][:[GROUP]] FILE...', 'Change the user and/or group ownership of each FILE. Only root can give files away, so you usually need sudo.',
            `-R, --recursive :: operate on files and directories recursively
-v, --verbose :: output a diagnostic for every file processed`,
            `sudo chown alice file.txt :: make alice the owner
sudo chown alice:developers file.txt :: owner and group
sudo chown -R www-data:www-data /var/www :: whole tree
sudo chown :developers shared/ :: change only the group`],
        chgrp: ['change group ownership', 'Permissions', 'chgrp [OPTION]... GROUP FILE...', 'Change the group of each FILE to GROUP.', `-R :: operate recursively`, `chgrp developers project/ :: change group (you must be a member)`],
        umask: ['set file mode creation mask', 'Permissions', 'umask [-S] [MODE]', 'Display or set the mask that removes permissions from newly created files.', `-S :: symbolic output`, `umask :: show the current mask
umask 077 :: new files private to you`],
        basename: ['strip directory and suffix from filenames', 'Files & Navigation', 'basename NAME [SUFFIX]', 'Print NAME with any leading directory components removed. If specified, also remove a trailing SUFFIX.', `-a :: support multiple arguments
-s SUFFIX :: remove a trailing SUFFIX`, `basename /var/log/syslog :: syslog
basename report.txt .txt :: report`],
        dirname: ['strip last component from file name', 'Files & Navigation', 'dirname NAME...', 'Output each NAME with its last non-slash component and trailing slashes removed.', '', `dirname /var/log/syslog :: /var/log`],
        realpath: ['print the resolved path', 'Files & Navigation', 'realpath [OPTION]... FILE...', 'Print the resolved absolute file name; all symlinks, . and .. are resolved.', `-m :: no path components need exist`, `realpath ../documents :: absolute path`],
        readlink: ['print resolved symbolic links or canonical file names', 'Files & Navigation', 'readlink [OPTION]... FILE...', 'Print the value of a symbolic link or canonical file name.', `-f :: canonicalize by following every symlink`, `readlink /bin :: usr/bin
readlink -f /bin/ls :: /usr/bin/ls`],
        mktemp: ['create a temporary file or directory', 'Files & Navigation', 'mktemp [OPTION]... [TEMPLATE]', 'Create a temporary file or directory safely, and print its name.', `-d :: create a directory, not a file`, `mktemp :: /tmp/tmp.XXXXXXXXXX
mktemp -d :: temporary directory`],
        truncate: ['shrink or extend the size of a file', 'Files & Navigation', 'truncate -s SIZE FILE...', 'Shrink or extend the size of each FILE to the specified size.', `-s, --size=SIZE :: set or adjust the file size by SIZE bytes`, `truncate -s 0 big.log :: empty a log file`],
        dd: ['convert and copy a file', 'Files & Navigation', 'dd [OPERAND]...', 'Copy a file, converting and formatting according to the operands.', `if=FILE :: read from FILE instead of stdin
of=FILE :: write to FILE instead of stdout
bs=BYTES :: read and write up to BYTES bytes at a time
count=N :: copy only N input blocks`, `dd if=/dev/zero of=blank.img bs=1K count=4 :: create a 4KiB file of zeros`],
        // ---------------- text processing
        echo: ['display a line of text', 'Text Processing', 'echo [-neE] [STRING]...', 'Echo the STRING(s) to standard output, separated by spaces.',
            `-n :: do not output the trailing newline
-e :: enable interpretation of backslash escapes (\\n, \\t ...)
-E :: disable interpretation of backslash escapes (default)`,
            `echo "Hello, $USER" :: print with variable expansion
echo 'No $expansion here' :: single quotes are literal
echo -e "a\\tb\\nc" :: tabs and newlines
echo "line" >> file.txt :: append a line to a file
echo $((6 * 7)) :: arithmetic`],
        printf: ['format and print data', 'Text Processing', 'printf FORMAT [ARGUMENT]...', 'Print ARGUMENT(s) according to FORMAT. The format is reused until all arguments are consumed.',
            `%s :: string
%d :: integer
%f / %.2f :: floating point / with 2 decimals
%x :: hexadecimal
%5s / %-5s :: right / left aligned in width 5
\\n :: newline`,
            `printf "%s is %d years old\\n" Alice 30 :: formatted output
printf "%05.1f\\n" 3.14159 :: zero padding
printf "%-10s|\\n" a bb ccc :: aligned columns
printf "%x\\n" 255 :: ff`],
        grep: ['print lines that match patterns', 'Text Processing', 'grep [OPTION]... PATTERNS [FILE]...', 'Search for PATTERNS (basic regular expressions by default) in each FILE and print matching lines.',
            `-i, --ignore-case :: ignore case distinctions
-v, --invert-match :: select non-matching lines
-c, --count :: print only a count of matching lines
-n, --line-number :: prefix each line with its line number
-l, --files-with-matches :: print only names of files with matches
-r, --recursive :: search directories recursively
-w, --word-regexp :: match only whole words
-x, --line-regexp :: match only whole lines
-o, --only-matching :: print only the matched parts
-E, --extended-regexp :: PATTERNS are extended regular expressions
-F, --fixed-strings :: PATTERNS are strings, not regexes
-A NUM / -B NUM / -C NUM :: print NUM lines of trailing / leading / surrounding context
-q, --quiet :: no output, exit status only
-e PATTERN :: use PATTERN (can be repeated)`,
            `grep error server.log :: lines containing "error"
grep -i error server.log :: case-insensitive
grep -c ERROR server.log :: count matching lines
grep -rn "TODO" projects/ :: recursive with line numbers
grep -v '^#' config.conf :: hide comment lines
grep -E 'WARN|ERROR' app.log :: either word
grep -o '[0-9]\\+' data.txt :: print only numbers
ps aux | grep nginx :: filter another command's output`],
        sed: ['stream editor for filtering and transforming text', 'Text Processing', 'sed [OPTION]... SCRIPT [FILE]...', 'Apply editing commands to each input line. The most common command is s/REGEX/REPLACEMENT/FLAGS.',
            `-n, --quiet :: suppress automatic printing of pattern space
-e SCRIPT :: add the script to the commands to be executed
-i[SUFFIX] :: edit files in place (makes backup if SUFFIX supplied)
-E, -r :: use extended regular expressions
s/re/rep/g :: substitute all matches on each line
Nd / /re/d :: delete line N / lines matching re
Np :: print line N (use with -n)
a TEXT / i TEXT :: append / insert TEXT
y/abc/xyz/ :: transliterate characters`,
            `sed 's/foo/bar/' file :: replace first foo on each line
sed 's/foo/bar/g' file :: replace every foo
sed -i 's/8080/9090/g' config.ini :: edit a file in place
sed -n '5,10p' file :: print lines 5 to 10
sed '/^$/d' file :: delete empty lines
sed '1d' data.csv :: drop the header line
sed -E 's/([0-9]+)/[\\1]/g' file :: wrap numbers in brackets`],
        awk: ['pattern scanning and processing language', 'Text Processing', "awk [-F fs] [-v var=value] 'program' [FILE]...", 'awk reads input line by line, splits each line into fields ($1, $2 ... $NF) and runs pattern { action } rules. Special variables: NR (line number), NF (number of fields), FS/OFS (field separators). BEGIN and END blocks run before/after input.',
            `-F fs :: use fs as the input field separator
-v var=value :: assign a variable before execution
$0 / $1 / $NF :: whole line / first field / last field
NR / NF :: record number / number of fields
BEGIN { } END { } :: run before / after the input
printf / print :: output statements
length() substr() split() toupper() gsub() :: built-in functions`,
            `awk '{print $1}' file :: first column
awk -F: '{print $1}' /etc/passwd :: usernames
awk -F, '$4 > 60000 {print $2}' employees.csv :: filter by a numeric column
awk '{sum += $1} END {print sum}' numbers.txt :: sum a column
awk 'NR==3' file :: print the third line
awk '{print NF}' file :: number of fields per line
awk -F, '{c[$3]++} END {for (d in c) print d, c[d]}' data.csv :: count per group`],
        sort: ['sort lines of text files', 'Text Processing', 'sort [OPTION]... [FILE]...', 'Write sorted concatenation of all FILE(s) to standard output.',
            `-n, --numeric-sort :: compare according to string numerical value
-r, --reverse :: reverse the result of comparisons
-u, --unique :: output only the first of an equal run
-k, --key=POS1[,POS2] :: sort via a key (field number)
-t, --field-separator=SEP :: use SEP instead of blank-to-nonblank transition
-h, --human-numeric-sort :: compare human readable numbers (2K 1G)
-f, --ignore-case :: fold lower case to upper case characters
-V, --version-sort :: natural sort of (version) numbers
-o FILE :: write result to FILE`,
            `sort names.txt :: alphabetical
sort -n numbers.txt :: numeric
sort -rn numbers.txt :: largest first
sort -u fruits.txt :: sorted, without duplicates
sort -t, -k4 -n employees.csv :: sort CSV by 4th column numerically
du -h | sort -h :: sort human readable sizes`],
        uniq: ['report or omit repeated lines', 'Text Processing', 'uniq [OPTION]... [INPUT [OUTPUT]]', 'Filter adjacent matching lines. Usually combined with sort, since only adjacent duplicates are detected.',
            `-c, --count :: prefix lines by the number of occurrences
-d, --repeated :: only print duplicate lines, one for each group
-u, --unique :: only print unique lines
-i, --ignore-case :: ignore differences in case`,
            `sort fruits.txt | uniq :: remove duplicates
sort fruits.txt | uniq -c :: count each value
sort fruits.txt | uniq -c | sort -rn | head -3 :: top 3 most frequent
sort fruits.txt | uniq -d :: only values that repeat`],
        wc: ['print newline, word, and byte counts', 'Text Processing', 'wc [OPTION]... [FILE]...', 'Print newline, word, and byte counts for each FILE, and a total line if more than one FILE is specified.',
            `-l, --lines :: print the newline counts
-w, --words :: print the word counts
-c, --bytes :: print the byte counts
-m, --chars :: print the character counts
-L, --max-line-length :: print the maximum display width`,
            `wc notes.txt :: lines, words, bytes
wc -l server.log :: count lines
ls | wc -l :: count files in a directory
grep -c error log :: (alternative to grep | wc -l)`],
        head: ['output the first part of files', 'Text Processing', 'head [OPTION]... [FILE]...', 'Print the first 10 lines of each FILE to standard output.', `-n, --lines=[-]NUM :: print the first NUM lines (with -, all but the last NUM)
-c, --bytes=NUM :: print the first NUM bytes`, `head file :: first 10 lines
head -n 3 file :: first 3 lines
head -5 file :: also first 5 lines
ls -t | head -1 :: most recently modified file`],
        tail: ['output the last part of files', 'Text Processing', 'tail [OPTION]... [FILE]...', 'Print the last 10 lines of each FILE to standard output.', `-n, --lines=[+]NUM :: output the last NUM lines (with +, starting at line NUM)
-c, --bytes=NUM :: output the last NUM bytes
-f, --follow :: output appended data as the file grows`, `tail file :: last 10 lines
tail -n 20 /var/log/syslog :: last 20 lines
tail -n +2 data.csv :: everything except the header
tail -f app.log :: follow a growing log`],
        cut: ['remove sections from each line of files', 'Text Processing', 'cut OPTION... [FILE]...', 'Print selected parts of lines from each FILE to standard output.',
            `-d, --delimiter=DELIM :: use DELIM instead of TAB for field delimiter
-f, --fields=LIST :: select only these fields (e.g. 1,3 or 2-4)
-c, --characters=LIST :: select only these characters
-s, --only-delimited :: do not print lines not containing delimiters
--complement :: complement the set of selected fields`,
            `cut -d: -f1 /etc/passwd :: usernames
cut -d, -f2,4 employees.csv :: 2nd and 4th CSV columns
cut -c1-10 file :: first 10 characters of each line
echo "a-b-c" | cut -d- -f2 :: b`],
        tr: ['translate or delete characters', 'Text Processing', 'tr [OPTION]... SET1 [SET2]', 'Translate, squeeze, and/or delete characters from standard input, writing to standard output.',
            `-d, --delete :: delete characters in SET1
-s, --squeeze-repeats :: replace each sequence of a repeated character with one
-c, --complement :: use the complement of SET1
[:upper:] [:lower:] [:digit:] [:space:] :: character classes`,
            `echo hello | tr a-z A-Z :: HELLO
tr -d '\\r' < dos.txt > unix.txt :: remove carriage returns
echo "a   b" | tr -s ' ' :: squeeze spaces
tr ':' '\\n' <<< "$PATH" :: one PATH entry per line`],
        rev: ['reverse lines characterwise', 'Text Processing', 'rev [FILE]...', 'Copy the specified files, reversing the order of characters in every line.', '', `echo hello | rev :: olleh`],
        nl: ['number lines of files', 'Text Processing', 'nl [OPTION]... [FILE]...', 'Write each FILE to standard output, with line numbers added (non-empty lines by default).', `-b a :: number all lines
-w N :: use N columns for line numbers
-s STRING :: add STRING after line number`, `nl script.sh :: numbered listing`],
        tee: ['read from standard input and write to standard output and files', 'Text Processing', 'tee [OPTION]... [FILE]...', 'Copy standard input to each FILE, and also to standard output.', `-a, --append :: append to the given FILEs, do not overwrite`, `ls | tee listing.txt :: show and save
echo "x" | sudo tee /etc/file :: write a root-owned file
make 2>&1 | tee build.log :: keep a build log`],
        paste: ['merge lines of files', 'Text Processing', 'paste [OPTION]... [FILE]...', 'Write lines consisting of the sequentially corresponding lines from each FILE, separated by TABs.', `-d, --delimiters=LIST :: reuse characters from LIST instead of TABs
-s, --serial :: paste one file at a time instead of in parallel`, `paste names.txt ages.txt :: side by side
paste -sd, list.txt :: join all lines with commas`],
        comm: ['compare two sorted files line by line', 'Text Processing', 'comm [OPTION]... FILE1 FILE2', 'Column one contains lines unique to FILE1, column two lines unique to FILE2, column three lines common to both.', `-1 / -2 / -3 :: suppress column 1 / 2 / 3`, `comm -12 a.txt b.txt :: lines in both files`],
        diff: ['compare files line by line', 'Text Processing', 'diff [OPTION]... FILE1 FILE2', 'Compare files line by line and print the differences.',
            `-u, -U NUM :: output NUM (default 3) lines of unified context
-q, --brief :: report only when files differ
-i :: ignore case differences
-w :: ignore all white space
-y :: output in two columns
-r :: recursively compare subdirectories`,
            `diff old.txt new.txt :: classic diff
diff -u old.txt new.txt :: unified diff (like git)
diff -q a b :: just say whether they differ`],
        cmp: ['compare two files byte by byte', 'Text Processing', 'cmp [OPTION]... FILE1 FILE2', 'Compare two files byte by byte and report the first difference.', `-s :: silent, exit status only`, `cmp a.bin b.bin :: first differing byte`],
        column: ['columnate lists', 'Text Processing', 'column [OPTION]... [FILE]...', 'Format input into multiple columns or a table.', `-t :: determine the number of columns the input contains and create a table
-s SEP :: specify the input delimiter for -t`, `column -t -s, data.csv :: pretty-print a CSV
mount | column -t :: align output`],
        fold: ['wrap each input line to fit in specified width', 'Text Processing', 'fold [OPTION]... [FILE]...', 'Wrap input lines in each FILE, writing to standard output.', `-w, --width=WIDTH :: use WIDTH columns instead of 80
-s, --spaces :: break at spaces`, `fold -w 40 -s essay.txt :: wrap at 40 columns`],
        fmt: ['simple optimal text formatter', 'Text Processing', 'fmt [-w WIDTH] [FILE]...', 'Reformat each paragraph in the FILE(s).', `-w WIDTH :: maximum line width`, `fmt -w 60 notes.txt :: reflow paragraphs`],
        expand: ['convert tabs to spaces', 'Text Processing', 'expand [-t N] [FILE]...', 'Convert tabs in each FILE to spaces.', `-t N :: have tabs N characters apart`, `expand -t 4 code.py :: tabs to 4 spaces`],
        unexpand: ['convert spaces to tabs', 'Text Processing', 'unexpand [FILE]...', 'Convert leading blanks to tabs.', '', `unexpand file :: spaces to tabs`],
        seq: ['print a sequence of numbers', 'Text Processing', 'seq [OPTION]... [FIRST [INCREMENT]] LAST', 'Print numbers from FIRST to LAST, in steps of INCREMENT.', `-s, --separator=STRING :: use STRING to separate numbers
-w, --equal-width :: equalize width by padding with leading zeroes
-f, --format=FORMAT :: use printf style floating-point FORMAT`, `seq 5 :: 1 2 3 4 5
seq 0 10 100 :: 0 10 20 ... 100
seq -w 01 10 :: zero padded
seq -s, 5 :: 1,2,3,4,5`],
        yes: ['output a string repeatedly until killed', 'Text Processing', 'yes [STRING]...', 'Repeatedly output a line with all specified STRING(s), or "y". (The sandbox stops after a few thousand lines.)', '', `yes | head -3 :: y y y
yes no | head -2 :: no no`],
        shuf: ['generate random permutations', 'Text Processing', 'shuf [OPTION]... [FILE]', 'Write a random permutation of the input lines to standard output.', `-n, --head-count=COUNT :: output at most COUNT lines
-e :: treat each ARG as an input line
-i, --input-range=LO-HI :: treat each number LO through HI as an input line`, `shuf -n 1 words.txt :: random word
shuf -i 1-100 -n 5 :: 5 random numbers`],
        xargs: ['build and execute command lines from standard input', 'Pipes & Redirection', 'xargs [OPTION]... [COMMAND [INITIAL-ARGS]...]', 'Read items from standard input and execute COMMAND with them as arguments.',
            `-n MAX-ARGS :: use at most MAX-ARGS arguments per command line
-I REPLACE :: replace occurrences of REPLACE in the command with each input line
-0, --null :: items are terminated by a null character
-r :: do not run the command if input is empty
-t :: print commands before executing them`,
            `find . -name "*.tmp" | xargs rm :: delete found files
echo a b c | xargs -n1 echo :: one argument per call
ls *.txt | xargs -I {} cp {} {}.bak :: back up each file
cat urls.txt | xargs -n1 curl -sO :: download a list`],
        less: ['view a file one screen at a time', 'Text Processing', 'less [FILE]...', 'A pager: scroll through text. Keys: Space/PgDn next page, b/PgUp previous page, j/k or arrows to move a line, g/G start/end, /pattern to search, n next match, q to quit.', `-N :: show line numbers`, `less /var/log/syslog :: browse a log
man ls | less :: page any output
ps aux | less :: scroll through processes`],
        more: ['file perusal filter for crt viewing', 'Text Processing', 'more [FILE]...', 'A simple pager. Space for next page, q to quit.', '', `more notes.txt :: page through a file`],
        bc: ['an arbitrary precision calculator language', 'Utilities', 'bc [-l] [FILE]...', 'A calculator reading expressions from files or standard input. Set "scale=N" for N decimal places; -l loads the math library (scale=20).', `-l :: define the standard math library`, `echo "2+3*4" | bc :: 14
echo "scale=2; 10/3" | bc :: 3.33
echo "2^10" | bc :: 1024
echo "sqrt(2)" | bc -l :: 1.414...`],
        expr: ['evaluate expressions', 'Utilities', 'expr EXPRESSION', 'Print the value of EXPRESSION. Operators must be separate arguments (escape * as \\*).', '', `expr 2 + 3 :: 5
expr 6 \\* 7 :: 42
expr length "hello" :: 5`],
        factor: ['factor numbers', 'Utilities', 'factor [NUMBER]...', 'Print the prime factors of each NUMBER.', '', `factor 360 :: 360: 2 2 2 3 3 5`],
        date: ['print or set the system date and time', 'System Information', 'date [OPTION]... [+FORMAT]', 'Display the current time in the given FORMAT.',
            `-d, --date=STRING :: display time described by STRING, not "now"
-u, --utc :: print Coordinated Universal Time
-I :: output date in ISO 8601 format
+%Y-%m-%d :: year-month-day
+%H:%M:%S :: hours:minutes:seconds
+%s :: seconds since 1970-01-01 UTC
+%A :: full weekday name`,
            `date :: current date and time
date +%F :: 2026-11-04
date "+%Y-%m-%d %H:%M" :: custom format
date -d "yesterday" +%F :: yesterday's date
date +%s :: Unix timestamp`],
        cal: ['display a calendar', 'Utilities', 'cal [[MONTH] YEAR]', 'Display a calendar for the current month, a given month, or a whole year.', '', `cal :: this month
cal 2026 :: whole year
cal 12 2026 :: December 2026`],
        md5sum: ['compute and check MD5 message digest', 'Security', 'md5sum [OPTION]... [FILE]...', 'Print or check MD5 (128-bit) checksums.', `-c, --check :: read checksums from the FILEs and check them`, `md5sum file.iso :: checksum a file
md5sum * > sums.md5 :: save checksums
md5sum -c sums.md5 :: verify them`],
        sha256sum: ['compute and check SHA256 message digest', 'Security', 'sha256sum [OPTION]... [FILE]...', 'Print or check SHA256 (256-bit) checksums.', `-c, --check :: read checksums from the FILEs and check them`, `sha256sum download.tar.gz :: verify a download
echo -n hi | sha256sum :: hash a string`],
        sha1sum: ['compute and check SHA1 message digest', 'Security', 'sha1sum [OPTION]... [FILE]...', 'Print or check SHA1 (160-bit) checksums.', `-c :: check`, `sha1sum file :: SHA1 of a file`],
        cksum: ['checksum and count the bytes in a file', 'Security', 'cksum [FILE]...', 'Print CRC checksum and byte counts of each FILE.', '', `cksum file :: CRC and size`],
        base64: ['base64 encode/decode data', 'Utilities', 'base64 [OPTION]... [FILE]', 'Base64 encode or decode FILE, or standard input, to standard output.', `-d, --decode :: decode data
-w, --wrap=COLS :: wrap encoded lines after COLS characters (0 disables)`, `echo hello | base64 :: aGVsbG8K
echo aGVsbG8K | base64 -d :: hello`],
        xxd: ['make a hex dump or do the reverse', 'Utilities', 'xxd [OPTION]... [FILE]', 'Create a hex dump of the given file or standard input.', `-p :: output in plain hexdump style
-r :: reverse operation: convert hexdump into binary
-l LEN :: stop after LEN octets`, `echo hi | xxd :: 00000000: 6869 0a  hi.
xxd -p file :: plain hex`],
        od: ['dump files in octal and other formats', 'Utilities', 'od [OPTION]... [FILE]...', 'Write an unambiguous representation of FILE to standard output.', `-c :: printable characters or backslash escapes
-x :: hexadecimal 2-byte units
-A n :: no addresses`, `echo hi | od -c :: show characters`],
        strings: ['print the sequences of printable characters in files', 'Utilities', 'strings [-n MIN] FILE...', 'Print printable character sequences that are at least MIN (default 4) characters long.', `-n MIN :: minimum string length`, `strings /usr/bin/ls :: readable text in a binary`],
        jq: ['command-line JSON processor', 'Utilities', "jq [OPTIONS] FILTER [FILE]", 'Filter and transform JSON. (Simplified: supports ., .key, .[N], .[], keys, length and | pipes.)', `-r :: output raw strings
-c :: compact output`, `jq . data.json :: pretty print
jq '.[0].name' users.json :: a field
jq -r '.[].name' users.json :: every name`],
        // ---------------- archives
        tar: ['an archiving utility', 'Archives', 'tar [OPTION...] [FILE]...', 'Store many files in a single archive, optionally compressed with gzip (-z). Remember: c=create, x=extract, t=list, v=verbose, f=file, z=gzip.',
            `-c, --create :: create a new archive
-x, --extract :: extract files from an archive
-t, --list :: list the contents of an archive
-f, --file=ARCHIVE :: use archive file ARCHIVE
-z, --gzip :: filter the archive through gzip
-v, --verbose :: verbosely list files processed
-C, --directory=DIR :: change to directory DIR
--exclude=PATTERN :: exclude files matching PATTERN`,
            `tar -cvf backup.tar documents/ :: create an archive
tar -czvf backup.tar.gz documents/ :: create a gzip compressed archive
tar -tzf backup.tar.gz :: list contents
tar -xzvf backup.tar.gz :: extract here
tar -xzf backup.tar.gz -C /tmp :: extract into /tmp
tar czf site.tgz --exclude='*.log' site/ :: skip log files`],
        gzip: ['compress or expand files', 'Archives', 'gzip [OPTION]... [FILE]...', 'Reduce the size of the named files; each file is replaced by one with the extension .gz.', `-d, --decompress :: decompress
-k, --keep :: keep (don't delete) input files
-c, --stdout :: write on standard output
-l, --list :: list compressed file contents
-v, --verbose :: verbose mode`, `gzip big.log :: big.log -> big.log.gz
gzip -k notes.txt :: keep the original
gzip -d big.log.gz :: decompress`],
        gunzip: ['decompress files', 'Archives', 'gunzip [OPTION]... [FILE]...', 'Decompress files created by gzip.', `-k :: keep the compressed file`, `gunzip archive.gz :: decompress`],
        zcat: ['view compressed files', 'Archives', 'zcat [FILE]...', 'Print the uncompressed contents of gzip files.', '', `zcat log.gz | grep error :: search a compressed log`],
        zip: ['package and compress files', 'Archives', 'zip [-r] ARCHIVE FILE...', 'Create or update a .zip archive.', `-r :: recurse into directories
-q :: quiet
-j :: junk (don't record) directory names`, `zip -r site.zip site/ :: zip a directory
zip docs.zip *.txt :: zip several files`],
        unzip: ['list and extract files from a ZIP archive', 'Archives', 'unzip [-l] ARCHIVE [-d DIR]', 'Extract files from a .zip archive.', `-l :: list archive contents
-d DIR :: extract into DIR
-o :: overwrite without prompting
-q :: quiet`, `unzip site.zip :: extract here
unzip -l site.zip :: list contents
unzip site.zip -d /tmp/site :: extract elsewhere`],
        // ---------------- system information
        uname: ['print system information', 'System Information', 'uname [OPTION]...', 'Print certain system information. With no OPTION, same as -s.', `-a, --all :: print all information
-s :: kernel name
-n :: network node hostname
-r :: kernel release
-m :: machine hardware name
-o :: operating system`, `uname -a :: everything
uname -r :: kernel version`],
        hostname: ['show or set the system host name', 'System Information', 'hostname [OPTION] [NAME]', 'Display (or, as root, set) the system hostname.', `-I :: all IP addresses of the host
-f :: the fully qualified domain name
-s :: the short host name`, `hostname :: linux-arsenal
hostname -I :: IP addresses`],
        hostnamectl: ['control the system hostname', 'System Information', 'hostnamectl [COMMAND]', 'Query or change the system hostname and related settings.', `set-hostname NAME :: set the hostname (root)`, `hostnamectl :: system overview
sudo hostnamectl set-hostname web01 :: rename the machine`],
        timedatectl: ['control the system time and date', 'System Information', 'timedatectl [COMMAND]', 'Query and change the system clock and its settings.', '', `timedatectl :: show time settings`],
        uptime: ['tell how long the system has been running', 'System Information', 'uptime [OPTION]', 'Show the current time, how long the system has been running, users and load averages.', `-p, --pretty :: show uptime in pretty format
-s, --since :: system up since`, `uptime :: time, uptime and load
uptime -p :: up 3 days, 4 hours`],
        whoami: ['print effective user name', 'Users & Groups', 'whoami', 'Print the user name associated with the current effective user ID.', '', `whoami :: user
sudo whoami :: root`],
        id: ['print real and effective user and group IDs', 'Users & Groups', 'id [OPTION]... [USER]', 'Print user and group information for USER, or the current user.', `-u :: print only the user ID
-g :: print only the group ID
-G :: print all group IDs
-n :: print names instead of numbers`, `id :: your uid, gid and groups
id alice :: another user
id -un :: your user name`],
        groups: ['print the groups a user is in', 'Users & Groups', 'groups [USER]...', 'Print group memberships for each USERNAME or the current process.', '', `groups :: your groups
groups alice :: alice's groups`],
        who: ['show who is logged on', 'Users & Groups', 'who [OPTION]...', 'Print information about users who are currently logged in.', `-b :: time of last system boot
-q :: all login names and number of users`, `who :: logged in users
who -b :: last boot time`],
        w: ['show who is logged on and what they are doing', 'Users & Groups', 'w [USER]', 'Display information about the users currently on the machine and their processes.', '', `w :: users and load`],
        last: ['show a listing of last logged in users', 'Users & Groups', 'last [-n NUM] [USER]', 'Show a list of all users logged in (and out) since the log was created.', `-n NUM :: how many lines to show`, `last :: login history
last -n 3 :: last three logins`],
        free: ['display amount of free and used memory in the system', 'System Information', 'free [OPTION]', 'Display the total amount of free and used physical and swap memory.', `-h, --human :: show human-readable output
-m :: show output in mebibytes
-g :: show output in gibibytes
-t :: show total for RAM + swap`, `free -h :: memory in readable units
free -m :: memory in MiB`],
        lscpu: ['display information about the CPU architecture', 'System Information', 'lscpu', 'Display CPU architecture information from /proc/cpuinfo.', '', `lscpu :: CPU details
nproc :: just the number of CPUs`],
        nproc: ['print the number of processing units available', 'System Information', 'nproc', 'Print the number of processing units available.', '', `nproc :: 4`],
        lsblk: ['list block devices', 'System Information', 'lsblk [OPTION]...', 'List information about all available block devices (disks and partitions).', `-f :: output info about filesystems`, `lsblk :: disks and partitions
lsblk -f :: with filesystem types`],
        lsusb: ['list USB devices', 'System Information', 'lsusb', 'Display information about USB buses and devices.', '', `lsusb :: USB devices`],
        lspci: ['list all PCI devices', 'System Information', 'lspci', 'Display information about PCI buses and devices.', '', `lspci :: PCI devices`],
        lsmod: ['show the status of modules in the Linux Kernel', 'System Information', 'lsmod', 'Show which kernel modules are currently loaded.', '', `lsmod :: loaded kernel modules`],
        mount: ['mount a filesystem', 'System Information', 'mount [DEVICE DIR]', 'Without arguments, list mounted filesystems. As root, attach a filesystem.', '', `mount :: list mounts
mount | grep ext4 :: ext4 mounts`],
        umount: ['unmount file systems', 'System Information', 'umount DIR|DEVICE', 'Detach the file system(s) mentioned.', '', `sudo umount /mnt/usb :: unmount`],
        dmesg: ['print the kernel ring buffer', 'System Information', 'dmesg [OPTION]', 'Print kernel messages (hardware, drivers, boot).', `-T :: human readable timestamps`, `dmesg | tail :: latest kernel messages
dmesg | grep -i usb :: USB events`],
        sysctl: ['configure kernel parameters at runtime', 'System Information', 'sysctl [OPTION] [VARIABLE[=VALUE]]', 'View or modify kernel parameters.', `-a :: display all values
-n :: print only values`, `sysctl net.ipv4.ip_forward :: is routing enabled?
sysctl -a :: everything`],
        vmstat: ['report virtual memory statistics', 'System Information', 'vmstat', 'Report information about processes, memory, paging, block IO, traps and CPU activity.', '', `vmstat :: one snapshot`],
        iostat: ['report CPU and I/O statistics', 'System Information', 'iostat', 'Report CPU statistics and input/output statistics for devices.', '', `iostat :: CPU and disk stats`],
        lsof: ['list open files', 'Processes', 'lsof [-i]', 'List open files and the processes that opened them.', `-i :: list network connections`, `lsof -i :: network sockets
sudo lsof -i :80 :: who uses port 80?`],
        env: ['run a program in a modified environment', 'Shell Scripting', 'env [OPTION]... [NAME=VALUE]... [COMMAND [ARG]...]', 'Print the environment, or set each NAME to VALUE in the environment and run COMMAND.', `-i :: start with an empty environment
-u NAME :: remove variable from the environment`, `env :: print all environment variables
env LANG=C sort file :: run sort with a different locale
env | grep PATH :: find a variable`],
        printenv: ['print all or part of environment', 'Shell Scripting', 'printenv [VARIABLE]...', 'Print the values of the specified environment VARIABLE(s), or all of them.', '', `printenv HOME :: /home/user
printenv :: everything`],
        // ---------------- processes
        ps: ['report a snapshot of the current processes', 'Processes', 'ps [OPTIONS]', 'Display information about active processes. Both BSD (aux) and UNIX (-ef) syntax are supported.',
            `aux :: every process, user-oriented format (BSD syntax)
-e, -A :: select all processes
-f :: full-format listing
-u USER :: processes of USER
-p PID :: select by process ID
-C NAME :: select by command name
-o FORMAT :: user-defined format, e.g. pid,user,%cpu,cmd
--sort=-%cpu :: sort descending by CPU usage`,
            `ps :: processes in this terminal
ps aux :: every process
ps -ef :: every process, full format
ps aux | grep nginx :: find a process
ps -eo pid,user,%cpu,comm --sort=-%cpu | head :: top CPU users
ps -u alice :: processes owned by alice`],
        top: ['display Linux processes', 'Processes', 'top [OPTION]', 'Interactive, real-time view of running processes. Keys: q quit, M sort by memory, P sort by CPU, k kill.', `-b :: batch mode (print once and exit)
-n NUM :: number of iterations
-u USER :: only USER's processes`, `top :: live process view
top -b -n 1 | head -15 :: one snapshot`],
        htop: ['interactive process viewer', 'Processes', 'htop', 'A colorful interactive process viewer (install with apt). Keys: q quit, F6 sort.', '', `sudo apt install htop :: install it
htop :: run it`],
        kill: ['send a signal to a process', 'Processes', 'kill [-SIGNAL] PID...', 'Send a signal (default TERM) to processes. Use -9 (KILL) to force.', `-l :: list signal names
-9, -KILL :: kill immediately (cannot be caught)
-15, -TERM :: ask nicely to terminate (default)
-STOP / -CONT :: pause / resume`, `kill 1234 :: terminate process 1234
kill -9 1234 :: force kill
kill %1 :: kill background job 1
kill -l :: list signals`],
        killall: ['kill processes by name', 'Processes', 'killall [-SIGNAL] NAME...', 'Send a signal to all processes running any of the specified commands.', `-v :: report if the signal was successfully sent`, `killall python3 :: stop every python3 process`],
        pkill: ['signal processes based on name and other attributes', 'Processes', 'pkill [-SIGNAL] [OPTION] PATTERN', 'Look up processes by name pattern and send them a signal.', `-f :: match against the full command line
-u USER :: only USER's processes
-x :: exact match`, `pkill nginx :: by name
pkill -f miner.py :: by full command line`],
        pgrep: ['look up processes based on name', 'Processes', 'pgrep [OPTION] PATTERN', 'List process IDs matching PATTERN.', `-l :: list name as well
-a :: list full command line
-f :: match full command line
-u USER :: only USER's processes
-c :: count matches`, `pgrep nginx :: PIDs of nginx
pgrep -a python :: PID and command line`],
        pidof: ['find the process ID of a running program', 'Processes', 'pidof NAME...', 'Print the process IDs of the named programs.', '', `pidof sshd :: 512`],
        pstree: ['display a tree of processes', 'Processes', 'pstree [-p]', 'Show running processes as a tree.', `-p :: show PIDs`, `pstree -p :: tree with PIDs`],
        jobs: ['display status of jobs', 'Processes', 'jobs [-l]', 'List the active background jobs of this shell.', `-l :: list process IDs too`, `sleep 100 & :: start a background job
jobs :: list jobs
fg :: bring the last job to the foreground`],
        fg: ['move job to the foreground', 'Processes', 'fg [%JOB]', 'Resume a job in the foreground.', '', `fg %1 :: bring job 1 to the foreground`],
        bg: ['move jobs to the background', 'Processes', 'bg [%JOB]', 'Resume a stopped job in the background.', '', `bg %1 :: continue job 1 in the background`],
        nice: ['run a program with modified scheduling priority', 'Processes', 'nice [-n N] COMMAND', 'Run COMMAND with an adjusted niceness (-20 highest priority, 19 lowest).', `-n N :: add integer N to the niceness`, `nice -n 10 tar czf b.tgz big/ :: low priority job`],
        renice: ['alter priority of running processes', 'Processes', 'renice PRIORITY -p PID', 'Change the priority of a running process.', '', `renice 10 -p 2187 :: lower its priority`],
        nohup: ['run a command immune to hangups', 'Processes', 'nohup COMMAND [ARG]...', 'Run COMMAND, ignoring hangup signals; output goes to nohup.out.', '', `nohup ./long-task.sh & :: survives logout`],
        timeout: ['run a command with a time limit', 'Processes', 'timeout DURATION COMMAND', 'Start COMMAND, and kill it if still running after DURATION.', '', `timeout 5s ping google.com :: stop after 5 seconds`],
        watch: ['execute a program periodically, showing output fullscreen', 'Processes', 'watch [-n SECONDS] COMMAND', 'Run COMMAND repeatedly, displaying its output (the sandbox runs it once).', `-n SECONDS :: interval between updates`, `watch -n 1 free -h :: memory every second`],
        sleep: ['delay for a specified amount of time', 'Shell Scripting', 'sleep NUMBER[SUFFIX]', 'Pause for NUMBER seconds (suffix m, h or d for minutes, hours, days). Run with & to make a background job.', '', `sleep 5 :: wait five seconds
sleep 300 & :: background job you can see with jobs/ps`],
        // ---------------- privileges, users, groups
        sudo: ['execute a command as another user', 'Users & Groups', 'sudo [-u USER] COMMAND', 'Run COMMAND as the superuser (or USER). Members of the "sudo" group may use it.', `-u USER :: run as USER instead of root
-i :: start a login shell as root
-s :: start a shell as root
-l :: list your privileges`, `sudo apt update :: run as root
sudo -u alice whoami :: run as alice
sudo -i :: become root (exit to return)
sudo !! :: rerun the last command with sudo`],
        su: ['switch user', 'Users & Groups', 'su [-] [USER]', 'Start a shell as another user (root by default). "-" makes it a login shell. Type exit to return.', `-, -l :: login shell
-c CMD :: run a single command`, `su - :: become root
su alice :: become alice
su -c whoami alice :: run one command as alice`],
        passwd: ['change user password', 'Users & Groups', 'passwd [USER]', 'Change the password of a user account. Only root may change other users\' passwords.', `-l :: lock the account
-S :: display account status`, `passwd :: change your own password
sudo passwd alice :: reset alice's password`],
        useradd: ['create a new user', 'Users & Groups', 'useradd [OPTIONS] LOGIN', 'Low-level tool to create a user account (requires root).', `-m :: create the user's home directory
-s SHELL :: login shell
-g GROUP :: primary group
-G GROUPS :: supplementary groups (comma separated)
-d HOME :: home directory
-c COMMENT :: full name`, `sudo useradd -m -s /bin/bash carol :: new user with a home
sudo useradd -m -G developers dave :: and add to a group`],
        adduser: ['add a user or group to the system (friendly)', 'Users & Groups', 'adduser USER | adduser USER GROUP', 'Debian/Ubuntu friendly front end: creates the user, home and group. With two arguments, adds an existing user to a group.', '', `sudo adduser carol :: create a user
sudo adduser bob docker :: add bob to the docker group`],
        userdel: ['delete a user account', 'Users & Groups', 'userdel [-r] LOGIN', 'Delete a user account (requires root).', `-r :: remove the home directory too`, `sudo userdel -r carol :: delete user and home`],
        deluser: ['remove a user from the system', 'Users & Groups', 'deluser [--remove-home] USER', 'Friendly front end to remove a user.', `--remove-home :: delete the home directory`, `sudo deluser --remove-home carol :: delete user`],
        usermod: ['modify a user account', 'Users & Groups', 'usermod [OPTIONS] LOGIN', 'Modify a user account (requires root).', `-aG GROUPS :: append the user to supplementary GROUPS
-G GROUPS :: set supplementary groups (replaces!)
-s SHELL :: change login shell
-L / -U :: lock / unlock the account
-l NAME :: rename the login`, `sudo usermod -aG docker bob :: give bob docker access
sudo usermod -s /bin/zsh alice :: change shell`],
        groupadd: ['create a new group', 'Users & Groups', 'groupadd [-g GID] GROUP', 'Create a new group (requires root).', `-g GID :: numeric group ID`, `sudo groupadd devops :: new group`],
        groupdel: ['delete a group', 'Users & Groups', 'groupdel GROUP', 'Delete a group (requires root).', '', `sudo groupdel devops :: remove group`],
        gpasswd: ['administer /etc/group', 'Users & Groups', 'gpasswd -a USER GROUP | -d USER GROUP', 'Add or remove group members.', `-a USER :: add USER to GROUP
-d USER :: remove USER from GROUP`, `sudo gpasswd -a alice docker :: add alice
sudo gpasswd -d alice docker :: remove alice`],
        getent: ['get entries from administrative database', 'Users & Groups', 'getent DATABASE [KEY]...', 'Query passwd, group, hosts and other databases.', '', `getent passwd alice :: alice's account line
getent group sudo :: who is in sudo`],
        // ---------------- services & logs
        systemctl: ['control the systemd system and service manager', 'Services', 'systemctl [OPTIONS] COMMAND [UNIT]', 'Inspect and control services (units). Changing state requires root.',
            `status UNIT :: show runtime status
start / stop / restart UNIT :: change the running state
reload UNIT :: reload configuration
enable / disable UNIT :: start (or not) at boot (--now also starts/stops)
is-active / is-enabled UNIT :: query state (scriptable)
list-units --type=service :: list loaded services
list-unit-files :: list installed unit files`,
            `systemctl status nginx :: is nginx running?
sudo systemctl restart nginx :: restart it
sudo systemctl enable --now mysql :: start now and at boot
systemctl is-active ssh :: prints active/inactive
systemctl list-units --type=service :: running services`],
        service: ['run a System V init script', 'Services', 'service NAME COMMAND | service --status-all', 'Older interface for controlling services.', `--status-all :: status of every service`, `sudo service nginx restart :: restart nginx
service --status-all :: [ + ] running, [ - ] stopped`],
        journalctl: ['query the systemd journal', 'Services', 'journalctl [OPTIONS]', 'Print log entries from the systemd journal.', `-u UNIT :: show logs of UNIT
-n N :: show the last N entries
-p PRIORITY :: filter by priority (err, warning...)
-k :: kernel messages
-f :: follow
-r :: newest first`, `journalctl -u nginx :: nginx logs
journalctl -p err :: only errors
journalctl -n 20 :: last 20 entries`],
        crontab: ['maintain crontab files for individual users', 'Services', 'crontab [-u USER] {-l | -r | -e | FILE}', 'Schedule commands. Each line: minute hour day-of-month month day-of-week command.', `-l :: list the current crontab
-e :: edit the current crontab
-r :: remove the current crontab
FILE :: install FILE as the crontab`, `crontab -l :: show scheduled jobs
crontab -e :: edit jobs
echo "0 3 * * * /home/user/scripts/backup.sh" | crontab - :: install from stdin
*/5 * * * * cmd :: every 5 minutes`],
        // ---------------- packages
        apt: ['command-line package manager', 'Package Management', 'apt [OPTIONS] COMMAND [PKG...]', 'Install, remove, search and upgrade Debian/Ubuntu packages. Installing and removing requires root.',
            `update :: refresh the package index
upgrade :: install available upgrades
install PKG :: install packages
remove PKG :: remove packages (keep config)
purge PKG :: remove packages and their config
search TERM :: search package descriptions
show PKG :: package details
list --installed :: installed packages`,
            `sudo apt update :: refresh package lists
sudo apt install htop :: install a package
apt search cow :: find packages
apt show tree :: details
sudo apt remove cowsay :: uninstall
apt list --installed | grep git :: is git installed?`],
        'apt-get': ['APT package handling utility', 'Package Management', 'apt-get [OPTIONS] COMMAND [PKG...]', 'The classic, script-friendly version of apt.', `update / upgrade / install / remove / purge :: same as apt`, `sudo apt-get install -y curl :: non-interactive install`],
        'apt-cache': ['query the APT cache', 'Package Management', 'apt-cache search|show|policy PKG', 'Query package information.', '', `apt-cache policy nginx :: installed and candidate versions`],
        dpkg: ['package manager for Debian', 'Package Management', 'dpkg [OPTION] ACTION', 'Low-level package tool.', `-l [PATTERN] :: list installed packages
-L PKG :: list files installed by PKG
-s PKG :: status of PKG
-S FILE :: which package owns FILE
-i FILE.deb :: install a .deb file`, `dpkg -l | grep nginx :: is nginx installed?
dpkg -L tree :: files of the tree package
dpkg -S /usr/bin/ls :: which package provides ls`],
        snap: ['manage snap packages', 'Package Management', 'snap list', 'Manage snap packages (limited in the sandbox).', '', `snap list :: installed snaps`],
        // ---------------- networking
        ping: ['send ICMP ECHO_REQUEST to network hosts', 'Networking', 'ping [OPTION] HOST', 'Test whether a host is reachable and measure round-trip time.', `-c COUNT :: stop after sending COUNT packets
-i INTERVAL :: seconds between packets
-q :: quiet output (summary only)
-W TIMEOUT :: time to wait for a response`, `ping -c 4 google.com :: four pings
ping -c 1 192.168.1.1 :: is the router up?
ping -c 3 db.internal :: internal host`],
        ifconfig: ['configure a network interface', 'Networking', 'ifconfig [INTERFACE]', 'Display network interfaces (legacy tool; see ip).', '', `ifconfig :: all interfaces
ifconfig eth0 :: one interface`],
        ip: ['show / manipulate routing, network devices, interfaces', 'Networking', 'ip [OPTIONS] OBJECT COMMAND', 'Modern tool for network configuration.', `addr (a) :: IP addresses
link :: network devices
route (r) :: routing table
neigh :: ARP / neighbour table
-br :: brief output
-4 / -6 :: IPv4 / IPv6 only`, `ip a :: all addresses
ip -br a :: brief addresses
ip route :: routing table
ip route get 8.8.8.8 :: which route is used`],
        netstat: ['print network connections, routing tables, interface statistics', 'Networking', 'netstat [OPTIONS]', 'Show network sockets (legacy tool; see ss).', `-t :: TCP
-u :: UDP
-l :: listening sockets only
-n :: numeric addresses and ports
-p :: show PID/program name
-r :: routing table`, `netstat -tuln :: listening ports
sudo netstat -tulnp :: with programs`],
        ss: ['another utility to investigate sockets', 'Networking', 'ss [OPTIONS]', 'Dump socket statistics.', `-t / -u :: TCP / UDP
-l :: listening sockets
-n :: numeric
-p :: show processes
-s :: summary`, `ss -tuln :: listening ports
sudo ss -tulpn :: listening ports with processes`],
        route: ['show / manipulate the IP routing table', 'Networking', 'route [-n]', 'Show the kernel routing table.', `-n :: numeric`, `route -n :: routing table`],
        arp: ['manipulate the system ARP cache', 'Networking', 'arp [-a]', 'Show the IP-to-MAC address cache.', `-a :: BSD style output`, `arp -a :: neighbours`],
        curl: ['transfer a URL', 'Networking', 'curl [OPTIONS] URL', 'Transfer data from or to a server (HTTP, HTTPS, FTP ...). Prints the response body by default.',
            `-o FILE :: write output to FILE
-O :: write output to a file named like the remote file
-s :: silent mode
-I :: fetch headers only
-i :: include response headers
-L :: follow redirects
-X METHOD :: request method (GET, POST, PUT...)
-d DATA :: send DATA in a POST request
-H HEADER :: add a request header
-w FORMAT :: print info after transfer, e.g. %{http_code}`,
            `curl https://example.com :: fetch a page
curl -I https://example.com :: only headers
curl -o page.html https://example.com :: save to a file
curl -s httpbin.org/ip :: JSON API call
curl -s -o /dev/null -w "%{http_code}\\n" localhost :: just the status code
curl -X POST -d 'a=1' httpbin.org/post :: POST data`],
        wget: ['the non-interactive network downloader', 'Networking', 'wget [OPTION]... URL', 'Download files from the web.', `-O FILE :: write documents to FILE
-q :: quiet
-c :: continue a partial download
-P DIR :: save files to DIR`, `wget https://linux-arsenal.dev/data.csv :: download a file
wget -O page.html example.com :: choose the name
wget -q URL :: no progress output`],
        nslookup: ['query Internet name servers interactively', 'Networking', 'nslookup HOST', 'Look up the IP address of a host name (or the reverse).', '', `nslookup github.com :: resolve a name
nslookup 8.8.8.8 :: reverse lookup`],
        dig: ['DNS lookup utility', 'Networking', 'dig [@SERVER] NAME [TYPE] [+short]', 'Flexible DNS query tool.', `+short :: terse answer
TYPE :: A, AAAA, MX, NS, TXT...
-x ADDR :: reverse lookup`, `dig example.com :: full answer
dig +short github.com :: just the IP
dig google.com MX :: mail servers`],
        host: ['DNS lookup utility', 'Networking', 'host NAME', 'Simple DNS lookups.', '', `host github.com :: address and mail servers`],
        traceroute: ['print the route packets trace to network host', 'Networking', 'traceroute HOST', 'Show every router hop between you and HOST.', '', `traceroute google.com :: path to Google`],
        nmap: ['network exploration tool and security / port scanner', 'Networking', 'nmap [OPTIONS] TARGET', 'Discover hosts and open ports (install with apt). Only scan machines you own or are allowed to test!', `-sV :: probe service versions
-p PORTS :: ports to scan`, `nmap localhost :: open ports on this machine
nmap 192.168.1.0/24 :: find hosts on the LAN`],
        ssh: ['OpenSSH remote login client', 'Networking', 'ssh [OPTIONS] [USER@]HOST [COMMAND]', 'Log in to a remote machine securely (only localhost accepts logins in the sandbox).', `-p PORT :: port to connect to
-i KEY :: identity (private key) file
-v :: verbose`, `ssh alice@localhost :: log in as alice
ssh localhost uptime :: run a single command
ssh -i ~/.ssh/id_ed25519 user@web01 :: use a key`],
        scp: ['secure copy (remote file copy program)', 'Networking', 'scp [-r] SOURCE TARGET', 'Copy files between hosts over SSH.', `-r :: copy directories recursively`, `scp file.txt user@localhost:/tmp/ :: copy over ssh`],
        nc: ['arbitrary TCP and UDP connections', 'Networking', 'nc [-zv] HOST PORT', 'netcat: test or use TCP connections.', `-z :: scan without sending data
-v :: verbose`, `nc -zv localhost 22 :: is port 22 open?
nc -zv localhost 20-100 :: scan a range`],
        telnet: ['user interface to the TELNET protocol', 'Networking', 'telnet HOST PORT', 'Open a raw TCP connection (useful to test ports).', '', `telnet localhost 22 :: see the SSH banner`],
        ufw: ['uncomplicated firewall', 'Security', 'ufw COMMAND', 'Manage the netfilter firewall easily (requires root).', `status [verbose|numbered] :: show rules
enable / disable :: turn the firewall on / off
allow PORT[/PROTO] :: allow incoming traffic
deny PORT :: deny incoming traffic
delete allow PORT | delete NUM :: remove a rule`, `sudo ufw status :: current rules
sudo ufw allow 22/tcp :: allow SSH
sudo ufw deny 3306 :: block MySQL
sudo ufw enable :: turn it on`],
        iptables: ['administration tool for IPv4 packet filtering', 'Security', 'iptables [-L | -A CHAIN RULE | -D CHAIN RULE | -F]', 'Low-level firewall rules (requires root).', `-L :: list rules
-A CHAIN :: append a rule
-p PROTO --dport PORT -j TARGET :: match protocol/port and jump to ACCEPT/DROP
-F :: flush all rules`, `sudo iptables -L :: list rules
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT :: allow ssh`],
        // ---------------- dev tools
        git: ['the stupid content tracker', 'Git', 'git [-C PATH] COMMAND [ARGS]', 'Distributed version control: track changes to files, branch, merge and collaborate.',
            `init :: create a repository
status :: what changed
add FILE / add . :: stage changes
commit -m MSG :: record staged changes
log --oneline :: history
diff [--staged] :: show changes
branch NAME / switch NAME :: create / change branch
merge BRANCH :: join histories
stash / stash pop :: shelve changes
restore FILE / reset :: undo changes
remote add origin URL / push / pull :: collaborate`,
            `git init :: start tracking a project
git config --global user.name "Your Name" :: set your identity
git add . && git commit -m "first commit" :: commit everything
git log --oneline --graph :: compact history
git switch -c feature :: new branch
git merge feature :: merge it
git diff --staged :: review before commit
git restore file.txt :: discard changes`],
        docker: ['container runtime', 'Containers', 'docker COMMAND [OPTIONS]', 'Build, ship and run containers (you are in the docker group).',
            `run [-d] [-p H:C] [--name N] IMAGE [CMD] :: create and start a container
ps [-a] :: list containers
images :: list images
pull IMAGE :: download an image
stop / start / restart / rm NAME :: manage containers
logs NAME :: container output
exec NAME CMD :: run a command in a running container
build -t NAME . :: build an image from a Dockerfile
volume / network :: manage volumes / networks`,
            `docker run hello-world :: test the installation
docker run -d --name web -p 8080:80 nginx :: web server on port 8080
docker ps :: running containers
docker logs web :: its output
docker exec web nginx -v :: run a command inside
docker stop web && docker rm web :: clean up
docker build -t myapp . :: build from ./Dockerfile`],
        python3: ['an interpreted, interactive, object-oriented programming language', 'Utilities', 'python3 [-c CMD | FILE]', 'Run Python (the sandbox supports simple print/assignment scripts).', `-c CMD :: program passed in as string
--version :: print the version`, `python3 --version :: Python 3.12.3
python3 -c "print(2**10)" :: 1024
python3 hello.py :: run a script`],
        nano: ['Nano\'s ANOther editor', 'Editors', 'nano [FILE]', 'A simple, friendly text editor. Shortcuts are shown at the bottom: ^ means Ctrl. Ctrl+O saves, Ctrl+X exits, Ctrl+K cuts a line, Ctrl+U pastes, Ctrl+W searches.', `Ctrl+O :: write (save) the file
Ctrl+X :: exit
Ctrl+K / Ctrl+U :: cut / paste line
Ctrl+W :: search
Ctrl+G :: help`, `nano notes.txt :: edit a file
sudo nano /etc/hosts :: edit a system file`],
        vim: ['Vi IMproved, a programmer\'s text editor', 'Editors', 'vim [FILE]', 'A modal editor. Normal mode: move with h j k l, x delete char, dd delete line, yy copy, p paste, u undo. Press i to insert text and Esc to return. Commands: :w save, :q quit, :wq save and quit, :q! quit without saving, /text search.', `i / a / o :: insert before cursor / after / new line
Esc :: back to normal mode
:w / :q / :wq / :q! :: save / quit / both / discard
dd / yy / p :: delete line / copy line / paste
/word :: search forward`, `vim script.sh :: edit a script
vi /etc/hosts :: vi is vim here too`],
        // ---------------- shell builtins
        alias: ['define or display aliases', 'Shell Scripting', "alias [NAME[='VALUE']]...", 'Define shortcuts for commands. Without arguments, list aliases.', '', `alias :: list aliases
alias ll='ls -alF' :: define one
alias gs='git status' :: save typing
unalias ll :: remove it`],
        unalias: ['remove alias definitions', 'Shell Scripting', 'unalias [-a] NAME...', 'Remove each NAME from the list of defined aliases.', `-a :: remove all`, `unalias ll :: remove ll`],
        export: ['set export attribute for shell variables', 'Shell Scripting', 'export [NAME[=VALUE]]...', 'Mark variables to be passed to child processes (the environment).', `-p :: list exported variables
-n :: remove the export property`, `export EDITOR=vim :: set an environment variable
export PATH="$HOME/bin:$PATH" :: extend the PATH
export -p :: list`],
        unset: ['unset values and attributes of shell variables and functions', 'Shell Scripting', 'unset [-fv] NAME...', 'Remove variables or functions.', `-f :: treat NAME as a function`, `unset TEMP :: delete a variable`],
        set: ['set or unset values of shell options and positional parameters', 'Shell Scripting', 'set [-eux] [-o OPTION] [--] [ARG...]', 'Change shell options or positional parameters. Without arguments, print all variables.', `-e :: exit on errors
-x :: print commands as they run (trace)
-u :: error on unset variables
-o pipefail :: a pipeline fails if any part fails`, `set -x :: debug a script
set -- a b c :: set $1 $2 $3`],
        source: ['execute commands from a file in the current shell', 'Shell Scripting', 'source FILE [ARGS]', 'Read and execute commands from FILE in the current shell (also written as ".").', '', `source ~/.bashrc :: reload your config
. ./env.sh :: load variables`],
        history: ['display or manipulate the history list', 'Shell Scripting', 'history [-c] [-d OFFSET] [N]', 'Show previously typed commands. Use !N to rerun number N, !! for the last command, Ctrl+R to search.', `-c :: clear the history
-d N :: delete entry N`, `history :: list commands
history 10 :: last 10
!! :: run the previous command
!grep :: rerun the last grep`],
        type: ['display information about command type', 'Shell Scripting', 'type [-at] NAME...', 'Indicate how each NAME would be interpreted: alias, keyword, function, builtin or file.', `-a :: all locations
-t :: single word: alias, keyword, function, builtin, file`, `type ls :: ls is aliased to ...
type cd :: cd is a shell builtin
type -a echo :: builtin and /usr/bin/echo`],
        which: ['locate a command', 'Shell Scripting', 'which [-a] NAME...', 'Print the full path of executables found in $PATH.', `-a :: print all matches`, `which python3 :: /usr/bin/python3`],
        whereis: ['locate the binary, source and manual page files for a command', 'Shell Scripting', 'whereis NAME...', 'Locate the binary and manual page for a command.', '', `whereis ls :: binary and man page`],
        test: ['check file types and compare values', 'Shell Scripting', 'test EXPRESSION | [ EXPRESSION ]', 'Exit with status 0 (true) or 1 (false) after evaluating EXPRESSION. Used in if and while.',
            `-f FILE / -d FILE / -e FILE :: is a file / directory / exists
-r / -w / -x FILE :: readable / writable / executable
-s FILE :: exists and is not empty
-z STR / -n STR :: string is empty / non-empty
S1 = S2, S1 != S2 :: string comparison
N1 -eq -ne -lt -le -gt -ge N2 :: integer comparison
! EXPR, EXPR -a EXPR, EXPR -o EXPR :: not, and, or`,
            `[ -f notes.txt ] && echo exists :: file test
[ "$USER" = root ] || echo "not root" :: string test
if [ $n -gt 10 ]; then echo big; fi :: numeric test`],
        read: ['read a line from the standard input', 'Shell Scripting', 'read [-r] [-p PROMPT] [-a ARRAY] [NAME...]', 'Read a line and split it into the NAMEs. Often used in while loops.', `-r :: do not treat backslashes as escapes
-p PROMPT :: print PROMPT first
-n N :: read N characters`, `while read line; do echo "$line"; done < file :: loop over lines
echo "a b" | { read x y; echo $y; } :: split into variables
IFS=: read user rest <<< "$line" :: custom separator`],
        printf2: null,
        let: ['evaluate arithmetic expressions', 'Shell Scripting', 'let ARG...', 'Evaluate each ARG as an arithmetic expression.', '', `let x=5*2 :: x=10
let x++ :: increment`],
        declare: ['set variable values and attributes', 'Shell Scripting', 'declare [-ilurx] [NAME[=VALUE]]...', 'Declare variables and give them attributes.', `-i :: integer
-l / -u :: convert to lower / upper case
-r :: readonly
-x :: export`, `declare -i n=5+5 :: n=10
declare -u name=bob :: BOB`],
        local: ['define local variables', 'Shell Scripting', 'local NAME[=VALUE]...', 'Create a variable visible only inside the current function.', '', `f() { local x=1; echo $x; } :: function-scoped variable`],
        readonly: ['mark shell variables as unchangeable', 'Shell Scripting', 'readonly NAME[=VALUE]', 'Make variables read-only.', '', `readonly PI=3.14 :: constant`],
        shift: ['shift positional parameters', 'Shell Scripting', 'shift [N]', 'Rename positional parameters $N+1... to $1...', '', `shift :: drop $1`],
        eval: ['execute arguments as a shell command', 'Shell Scripting', 'eval [ARG...]', 'Combine ARGs into a single string and execute it.', '', `cmd="ls -l"; eval $cmd :: run a command stored in a string`],
        exec: ['replace the shell with the given command', 'Shell Scripting', 'exec [COMMAND]', 'Execute COMMAND, replacing this shell.', '', `exec bash :: restart the shell`],
        exit: ['exit the shell', 'Shell Scripting', 'exit [N]', 'Exit the shell (or su/sudo session) with status N.', '', `exit :: leave a root session
exit 1 :: from a script: signal failure`],
        return: ['return from a shell function', 'Shell Scripting', 'return [N]', 'Return from a function with status N.', '', `check() { return 1; } :: function that fails`],
        break: ['exit for, while, or until loops', 'Shell Scripting', 'break [N]', 'Exit from a loop.', '', `for i in 1 2 3; do [ $i = 2 ] && break; echo $i; done :: prints 1`],
        continue: ['resume the next iteration of a loop', 'Shell Scripting', 'continue [N]', 'Skip to the next loop iteration.', '', `for i in 1 2 3; do [ $i = 2 ] && continue; echo $i; done :: prints 1 3`],
        pushd: ['add directories to stack', 'Files & Navigation', 'pushd [DIR]', 'Save the current directory on a stack and change to DIR.', '', `pushd /etc :: go to /etc, remember where you were
popd :: and come back`],
        popd: ['remove directories from stack', 'Files & Navigation', 'popd', 'Remove the top directory from the stack and cd to it.', '', `popd :: return to the saved directory`],
        dirs: ['display directory stack', 'Files & Navigation', 'dirs [-v]', 'Display the list of remembered directories.', `-v :: one per line, with index`, `dirs -v :: directory stack`],
        clear: ['clear the terminal screen', 'Shell Scripting', 'clear', 'Clear the screen (also Ctrl+L).', '', `clear :: blank screen`],
        reset: ['reset the terminal', 'Shell Scripting', 'reset', 'Reinitialize the terminal.', '', `reset :: fix a garbled screen`],
        time: ['time a simple command', 'Shell Scripting', 'time COMMAND', 'Run COMMAND and print how long it took.', '', `time sort big.txt > /dev/null :: measure`],
        true: ['do nothing, successfully', 'Shell Scripting', 'true', 'Exit with a status code indicating success.', '', `while true; do ...; done :: infinite loop (the sandbox stops runaway loops)`],
        false: ['do nothing, unsuccessfully', 'Shell Scripting', 'false', 'Exit with a status code indicating failure.', '', `false || echo "failed" :: prints failed`],
        help: ['display information about builtin commands', 'Help', 'help [COMMAND]', 'Show the overview of everything you can do, or help for a COMMAND.', '', `help :: overview
help cd :: help for cd`],
        man: ['an interface to the system reference manuals', 'Help', 'man [-k KEYWORD] COMMAND', 'Display the manual page for COMMAND. In the pager: arrows/space to scroll, / to search, q to quit.', `-k KEYWORD :: search manual page names and descriptions (like apropos)
-f COMMAND :: one-line description (like whatis)`, `man ls :: manual for ls
man -k network :: find networking commands
man man :: manual about manuals`],
        whatis: ['display one-line manual page descriptions', 'Help', 'whatis COMMAND...', 'Show a one-line description of each COMMAND.', '', `whatis grep :: grep (1) - print lines that match patterns`],
        apropos: ['search the manual page names and descriptions', 'Help', 'apropos KEYWORD', 'Search all manual page descriptions for KEYWORD.', '', `apropos copy :: commands about copying`],
        tldr: ['simplified, example based help pages', 'Help', 'tldr COMMAND', 'Show practical examples for COMMAND.', '', `tldr tar :: how do I use tar again?`],
        examples: ['show runnable examples for a command', 'Help', 'examples [COMMAND|CATEGORY]', 'Show practical, copy-paste ready examples. Without an argument, list the categories.', '', `examples grep :: grep examples
examples Networking :: a whole category`],
        tutorial: ['interactive guided tour', 'Help', 'tutorial [start|next|skip|status|quit|reset]', 'A step-by-step interactive lesson that checks what you type.', '', `tutorial :: start or resume
tutorial skip :: skip the current step`],
        challenge: ['play challenges inside the terminal', 'Help', 'challenge [list|start ID|random|hint|solution|check|reset|quit|info]', 'Load any of the generated challenges into this terminal. Each challenge gets its own sandbox machine and is checked automatically after every command.', '', `challenge list :: browse challenges
challenge random beginner :: start a random beginner challenge
challenge start 42 :: start challenge number 42
challenge hint :: get a hint
challenge quit :: back to the practice machine`],
        // ---------------- misc
        neofetch: ['a fast, highly customizable system info script', 'Fun', 'neofetch', 'Show system information next to the distribution logo (install with apt).', '', `sudo apt install neofetch :: install
neofetch :: run`],
        cowsay: ['configurable speaking/thinking cow', 'Fun', 'cowsay [-f COW] [-e EYES] MESSAGE', 'Generate an ASCII cow saying MESSAGE (install with apt).', `-f COW :: tux, dragon or sheep
-e EYES :: eye string
-d :: dead cow`, `cowsay Hello :: moo
fortune | cowsay :: wise cow
cowsay -f tux "Linux!" :: penguin`],
        figlet: ['display large characters made up of ordinary screen characters', 'Fun', 'figlet TEXT', 'Make large ASCII-art banners (install with apt).', '', `figlet Linux :: big letters`],
        fortune: ['print a random, hopefully interesting, adage', 'Fun', 'fortune', 'Print a random quote (install fortune-mod with apt).', '', `fortune :: wisdom`],
        sl: ['cure your bad habit of mistyping', 'Fun', 'sl', 'A steam locomotive runs across the terminal when you type sl instead of ls (install with apt).', '', `sl :: choo choo`],
        cmatrix: ['simulates the display from "The Matrix"', 'Fun', 'cmatrix', 'Falling green characters (install with apt). Press q to quit.', '', `cmatrix :: follow the white rabbit`],
        tput: ['query terminfo database', 'Shell Scripting', 'tput CAPABILITY', 'Output terminal control sequences.', `cols / lines :: terminal size
setaf N :: set foreground color
bold / sgr0 :: bold / reset`, `tput cols :: width of the terminal
echo "$(tput setaf 2)green$(tput sgr0)" :: colored text`],
        shutdown: ['halt, power off or reboot the machine', 'System Information', 'shutdown [OPTIONS] [TIME]', 'Power off or reboot (the sandbox never actually shuts down).', `-r :: reboot
now :: immediately`, `sudo shutdown -r now :: reboot`],
        reboot: ['reboot the machine', 'System Information', 'reboot', 'Reboot the system (requires root; simulated).', '', `sudo reboot :: reboot`],
        getopts: ['parse option arguments', 'Shell Scripting', 'getopts OPTSTRING NAME [ARG...]', 'Parse short options in scripts.', '', `while getopts "ab:" o; do echo $o $OPTARG; done :: option loop`],
        trap: ['trap signals and other events', 'Shell Scripting', 'trap [ACTION] [SIGNAL...]', 'Run ACTION when the shell receives SIGNAL (accepted, but signals are not delivered in the sandbox).', '', `trap 'rm -f /tmp/lock' EXIT :: cleanup on exit`],
        ulimit: ['modify shell resource limits', 'Shell Scripting', 'ulimit [-a]', 'Show resource limits.', `-a :: all limits`, `ulimit -a :: show limits`],
        hash: ['remember the full pathnames of commands', 'Shell Scripting', 'hash', 'Show the command hash table.', '', `hash :: hash table`],
        command: ['execute a simple command or display information about commands', 'Shell Scripting', 'command [-vV] COMMAND', 'Run COMMAND bypassing functions, or describe it.', `-v :: print the command path or name`, `command -v git :: is git installed?`],
        logname: ['print user\'s login name', 'Users & Groups', 'logname', 'Print the name of the user who logged in (even after su).', '', `logname :: user`],
        users: ['print the user names of users currently logged in', 'Users & Groups', 'users', 'List users currently logged in.', '', `users :: user`],
        lastlog: ['reports the most recent login of all users', 'Users & Groups', 'lastlog', 'Show the most recent login of every user.', '', `lastlog :: last login per user`],
        arch: ['print machine hardware name', 'System Information', 'arch', 'Same as uname -m.', '', `arch :: x86_64`]
    };
    delete RAW.printf2;
    const ALIASES = { egrep: 'grep', fgrep: 'grep', rg: 'grep', gawk: 'awk', mawk: 'awk', nawk: 'awk', gunzip: 'gunzip', '[': 'test', '[[': 'test', '.': 'source', vi: 'vim', 'view': 'vim', dir: 'ls', python: 'python3', poweroff: 'shutdown', halt: 'shutdown', tracepath: 'traceroute', cowthink: 'cowsay', typeset: 'declare', logout: 'exit', more: 'more', ':': 'true', most: 'less', pg: 'less' };

    const DOCS = {};
    const parseList = (s) => (s || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(' :: '); return i === -1 ? [l, ''] : [l.slice(0, i), l.slice(i + 4)]; });
    for (const [name, v] of Object.entries(RAW)) {
        if (!v) continue;
        DOCS[name] = { name, summary: v[0], category: v[1], synopsis: v[2], description: v[3], options: parseList(v[4]), examples: parseList(v[5]) };
    }
    function get(name) {
        if (DOCS[name]) return DOCS[name];
        if (ALIASES[name] && DOCS[ALIASES[name]]) return Object.assign({}, DOCS[ALIASES[name]], { name, aliasOf: ALIASES[name] });
        const cmd = LA.commands[name];
        if (cmd) return { name, summary: cmd.builtin ? 'shell builtin' : 'command', category: 'Other', synopsis: name + ' [ARGS]...', description: 'No detailed manual is available for ' + name + '.', options: [], examples: [], generated: true };
        return null;
    }

    function wrap(text, width, indent) {
        const words = text.split(/\s+/);
        const lines = [];
        let cur = '';
        for (const w of words) {
            if ((cur + ' ' + w).trim().length > width) { lines.push(cur); cur = w; }
            else cur = (cur + ' ' + w).trim();
        }
        if (cur) lines.push(cur);
        return lines.map((l) => indent + l).join('\n');
    }
    function manPage(name, opts) {
        const d = get(name);
        if (!d) return null;
        const B = opts && opts.color ? (s) => '\x1b[1m' + s + '\x1b[0m' : (s) => s;
        const UL = opts && opts.color ? (s) => '\x1b[4m' + s + '\x1b[0m' : (s) => s;
        const section = d.category === 'Shell Scripting' && LA.commands[name] && LA.commands[name].builtin ? 'BASH_BUILTINS(1)' : name.toUpperCase() + '(' + (['Users & Groups', 'Services', 'Security'].includes(d.category) && /add|del|mod|ctl|ufw|iptables|service/.test(name) ? '8' : '1') + ')';
        const out = [];
        out.push(section.padEnd(30) + 'Linux Arsenal Manual'.padEnd(30) + section);
        out.push('');
        out.push(B('NAME'));
        out.push('       ' + name + ' - ' + d.summary);
        out.push('');
        out.push(B('SYNOPSIS'));
        out.push('       ' + d.synopsis.replace(/^(\S+)/, (m) => B(m)));
        out.push('');
        out.push(B('DESCRIPTION'));
        out.push(wrap(d.description, 66, '       '));
        if (d.options.length) {
            out.push('');
            out.push(B('OPTIONS'));
            for (const [f, desc] of d.options) {
                out.push('       ' + B(f));
                out.push(wrap(desc, 60, '              '));
                out.push('');
            }
            out.pop();
        }
        if (d.examples.length) {
            out.push('');
            out.push(B('EXAMPLES'));
            for (const [cmd, desc] of d.examples) {
                out.push('       ' + UL(cmd));
                if (desc) out.push('              ' + desc);
            }
        }
        const related = Object.values(DOCS).filter((x) => x.category === d.category && x.name !== name).slice(0, 6).map((x) => x.name + '(1)');
        if (related.length) { out.push(''); out.push(B('SEE ALSO')); out.push('       ' + related.join(', ')); }
        out.push('');
        out.push('Linux Arsenal'.padEnd(30) + '2026-11-04'.padEnd(30) + section);
        return out.join('\n') + '\n';
    }
    function helpText(name) {
        const d = get(name);
        if (!d || d.generated) return null;
        let s = 'Usage: ' + d.synopsis + '\n' + d.summary.charAt(0).toUpperCase() + d.summary.slice(1) + '.\n\n' + wrap(d.description, 76, '') + '\n';
        if (d.options.length) {
            s += '\nOptions:\n';
            const w = Math.min(28, Math.max(...d.options.map((o) => o[0].length)) + 2);
            for (const [f, desc] of d.options) s += '  ' + f.padEnd(w) + ' ' + desc + '\n';
        }
        if (d.examples.length) {
            s += '\nExamples:\n';
            for (const [c, desc] of d.examples) s += '  ' + c + (desc ? '\n      # ' + desc : '') + '\n';
        }
        s += "\nFull documentation: man " + name + '\n';
        return s;
    }
    function categories() {
        const cats = {};
        for (const d of Object.values(DOCS)) (cats[d.category] = cats[d.category] || []).push(d.name);
        for (const k of Object.keys(cats)) cats[k].sort();
        return cats;
    }
    function overview() {
        const C = U.C;
        const cats = categories();
        let s = C.bgreen + 'Linux Arsenal' + C.reset + ' - a complete Linux machine simulated in your browser (GNU bash 5.2 compatible).\n';
        s += 'Everything is sandboxed: experiment freely, nothing can break your computer.\n\n';
        const order = ['Files & Navigation', 'Text Processing', 'Pipes & Redirection', 'Permissions', 'Users & Groups', 'Processes', 'System Information', 'Services', 'Package Management', 'Networking', 'Security', 'Archives', 'Shell Scripting', 'Git', 'Containers', 'Editors', 'Utilities', 'Help', 'Fun'];
        for (const cat of order) {
            if (!cats[cat]) continue;
            s += C.byellow + cat + C.reset + '\n';
            s += U.columnize(cats[cat], 78).split('\n').filter(Boolean).map((l) => '  ' + l).join('\n') + '\n';
        }
        s += '\n' + C.bcyan + 'Shell features' + C.reset + ': pipes |, redirection > >> < 2> &> 2>&1, here-docs <<EOF, && || ;, background &,\n';
        s += '  $VARS ${VAR:-default} ${#VAR} ${VAR/a/b}, $(command), $((math)), globs * ? [abc] {a,b} {1..10},\n';
        s += '  if/elif/else, for, while, until, case, functions, aliases, scripts (chmod +x ./script.sh), history (!!, !n).\n';
        s += C.bcyan + 'Keys' + C.reset + ': Tab complete, Up/Down history, Ctrl+R search, Ctrl+A/E start/end, Ctrl+U/K/W cut, Ctrl+Y paste,\n';
        s += '  Ctrl+L clear, Ctrl+C cancel, Alt+B/F word left/right.\n';
        s += C.bcyan + 'Learn' + C.reset + ': man CMD, CMD --help, tldr CMD, examples CMD, tutorial, challenge list.\n';
        return s;
    }

    // ---------------------------------------------------------------- commands
    const R = (name, fn, meta) => U.register(name, fn, meta);
    R('man', (ctx) => {
        const args = ctx.args.filter((a) => !/^\d$/.test(a));
        if (args[0] === '-k') return LA.commands.apropos.fn(Object.assign(ctx, { args: args.slice(1), name: 'apropos' }));
        if (args[0] === '-f') return LA.commands.whatis.fn(Object.assign(ctx, { args: args.slice(1), name: 'whatis' }));
        const name = args[0];
        if (!name) { ctx.err('What manual page do you want?\nFor example, try \'man man\'.\n'); return 1; }
        const page = manPage(name, { color: ctx.tty });
        if (!page) { ctx.err('No manual entry for ' + name + '\n'); return 16; }
        if (ctx.tty && ctx.sh.ui && ctx.sh.ui.openPager) { ctx.sh.ui.openPager({ text: page, title: 'Manual page ' + name + '(1)', man: true }); return 0; }
        ctx.out(U.stripAnsi(page));
        return 0;
    });
    R('info', (ctx) => LA.commands.man.fn(ctx));
    R('whatis', (ctx) => {
        let status = 0;
        for (const n of ctx.args) {
            const d = get(n);
            if (!d || d.generated) { ctx.err(n + ': nothing appropriate.\n'); status = 16; continue; }
            ctx.outln((n + ' (1)').padEnd(20) + ' - ' + d.summary);
        }
        return status;
    });
    R('apropos', (ctx) => {
        const kw = ctx.args.join(' ').toLowerCase();
        if (!kw) { ctx.err('apropos what?\n'); return 1; }
        const hits = Object.values(DOCS).filter((d) => d.name.includes(kw) || d.summary.toLowerCase().includes(kw) || d.category.toLowerCase().includes(kw) || d.description.toLowerCase().includes(kw)).sort((a, b) => (a.name < b.name ? -1 : 1));
        if (!hits.length) { ctx.err(kw + ': nothing appropriate.\n'); return 16; }
        for (const d of hits) ctx.outln((d.name + ' (1)').padEnd(20) + ' - ' + d.summary);
        return 0;
    });
    R('tldr', (ctx) => {
        const name = ctx.args.filter((a) => !a.startsWith('-'))[0];
        if (!name) { ctx.outln('Usage: tldr COMMAND\nExample: tldr tar'); return 1; }
        const d = get(name);
        if (!d || !d.examples.length) { ctx.err('Page not found for: ' + name + '\nTry: man ' + name + '\n'); return 1; }
        const C = ctx.tty ? U.C : { reset: '', bold: '', green: '', red: '', cyan: '', bwhite: '' };
        ctx.outln('\n  ' + C.bold + name + C.reset + '\n\n  ' + d.summary.charAt(0).toUpperCase() + d.summary.slice(1) + '.\n');
        for (const [cmd, desc] of d.examples) ctx.outln('  ' + C.green + '- ' + (desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : 'Example') + ':' + C.reset + '\n\n    ' + C.red + cmd + C.reset + '\n');
        return 0;
    });
    R('examples', (ctx) => {
        const arg = ctx.args.join(' ');
        const C = ctx.tty ? U.C : { reset: '', bold: '', green: '', yellow: '', cyan: '', gray: '', byellow: '' };
        const cats = categories();
        if (!arg) {
            ctx.outln('Example collections (run: examples <command> or examples <category>):\n');
            for (const [cat, names] of Object.entries(cats).sort()) ctx.outln('  ' + C.byellow + cat.padEnd(22) + C.reset + ' ' + names.length + ' commands');
            ctx.outln('\nTry: examples grep, examples Networking, examples "Shell Scripting"');
            return 0;
        }
        const catKey = Object.keys(cats).find((c) => c.toLowerCase() === arg.toLowerCase() || c.toLowerCase().startsWith(arg.toLowerCase()));
        const names = get(arg) && !get(arg).generated ? [arg] : catKey ? cats[catKey] : null;
        if (!names) return ctx.fail('no examples for "' + arg + '"');
        for (const n of names) {
            const d = get(n);
            if (!d.examples.length) continue;
            ctx.outln(C.byellow + n + C.reset + ' - ' + d.summary);
            for (const [cmd, desc] of d.examples) ctx.outln('  ' + C.green + '$ ' + cmd + C.reset + (desc ? '  ' + C.gray + '# ' + desc + C.reset : ''));
            ctx.outln('');
        }
        return 0;
    });

    for (const n of ['echo', 'git', 'docker', 'python3', 'python', 'test', '[', '[[', 'true', 'false', ':', 'printf']) if (LA.commands[n]) LA.commands[n].ownHelp = true;
    LA.docs = { get, manPage, helpText, overview, categories, all: DOCS, ALIASES };
})();
