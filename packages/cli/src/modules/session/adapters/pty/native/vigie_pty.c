#include <sys/ioctl.h>
#include <unistd.h>
#include <signal.h>
#include <string.h>
#include <stdlib.h>
#include <pthread.h>
#include <termios.h>

#ifdef __APPLE__
#include <util.h>
#else
#include <pty.h>
#endif

int pty_spawn(const char *cmd, char *const argv[], int rows, int cols, int *child_pid) {
    struct winsize ws;
    memset(&ws, 0, sizeof(ws));
    ws.ws_row = rows;
    ws.ws_col = cols;

    int master_fd;
    pid_t pid = forkpty(&master_fd, NULL, NULL, &ws);

    if (pid < 0) {
        return -1;
    }

    if (pid == 0) {
        signal(SIGINT, SIG_DFL);
        signal(SIGTERM, SIG_DFL);
        execvp(cmd, argv);
        _exit(127);
    }

    *child_pid = pid;
    return master_fd;
}

int pty_resize(int fd, int rows, int cols) {
    struct winsize ws;
    memset(&ws, 0, sizeof(ws));
    ws.ws_row = rows;
    ws.ws_col = cols;
    return ioctl(fd, TIOCSWINSZ, &ws);
}

/* ── stdin → PTY relay ── */

static struct termios saved_termios;
static volatile int relay_running = 0;

typedef struct {
    int master_fd;
} relay_args_t;

static void *stdin_relay_thread(void *arg) {
    relay_args_t *args = (relay_args_t *)arg;
    char buf[4096];
    ssize_t n;

    while (relay_running) {
        n = read(STDIN_FILENO, buf, sizeof(buf));
        if (n <= 0) break;
        write(args->master_fd, buf, n);
    }

    free(args);
    return NULL;
}

/* Enable raw mode on stdin and start a thread relaying stdin → master_fd. */
int pty_start_stdin_relay(int master_fd) {
    struct termios raw;

    if (tcgetattr(STDIN_FILENO, &saved_termios) < 0)
        return -1;

    raw = saved_termios;
    cfmakeraw(&raw);
    if (tcsetattr(STDIN_FILENO, TCSANOW, &raw) < 0)
        return -1;

    relay_running = 1;

    relay_args_t *args = malloc(sizeof(relay_args_t));
    if (!args) return -1;
    args->master_fd = master_fd;

    pthread_t thread;
    pthread_attr_t attr;
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);

    int ret = pthread_create(&thread, &attr, stdin_relay_thread, args);
    pthread_attr_destroy(&attr);

    if (ret != 0) {
        free(args);
        tcsetattr(STDIN_FILENO, TCSANOW, &saved_termios);
        return -1;
    }

    return 0;
}

/* Stop the stdin relay and restore terminal settings. */
int pty_stop_stdin_relay(void) {
    relay_running = 0;
    tcsetattr(STDIN_FILENO, TCSANOW, &saved_termios);
    return 0;
}
