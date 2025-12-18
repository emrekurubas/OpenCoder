import curses
import random
import time

class SnakeGame:
    def __init__(self, stdscr):
        self.stdscr = stdscr
        self.height = 20
        self.width = 40
        self.snake = [(10, 20)]
        self.direction = (0, 1)  # Start moving right
        self.score = 0
        self.place_food()
        self.curses_init()

    def curses_init(self):
        self.stdscr.nodelay(1)
        self.stdscr.timeout(100)
        self.stdscr.keypad(True)

    def place_food(self):
        while True:
            self.food = (random.randint(1, self.height-2), random.randint(1, self.width-2))
            if self.food not in self.snake:
                break

    def move(self):
        head = self.snake[0]
        new_head = (head[0] + self.direction[0], head[1] + self.direction[1])

        # Check if game over
        if (new_head[0] < 1 or new_head[0] >= self.height-1 or
            new_head[1] < 1 or new_head[1] >= self.width-1 or
            new_head in self.snake):
            return False  # game over

        # Otherwise, move the snake
        self.snake.insert(0, new_head)
        if new_head == self.food:
            self.score += 1
            self.place_food()
        else:
            self.snake.pop()

        return True

    def draw(self):
        self.stdscr.clear()
        self.stdscr.border()
        self.stdscr.addstr(0, 2, f" Score: {self.score} ", curses.color_pair(1))

        # Draw snake
        for i, (y, x) in enumerate(self.snake):
            char = 'O' if i == 0 else 'o'
            self.stdscr.addch(y, x, char, curses.color_pair(2))

        # Draw food
        self.stdscr.addch(self.food[0], self.food[1], '*', curses.color_pair(3))
        self.stdscr.refresh()

    def run(self):
        while True:
            self.draw()
            key = self.stdscr.getch()

            if key == ord('q'):
                break

            # Handle arrow keys and WASD
            new_dir = None
            if key in [curses.KEY_UP, ord('w'), ord('W')]:
                new_dir = (-1, 0)
            elif key in [curses.KEY_DOWN, ord('s'), ord('S')]:
                new_dir = (1, 0)
            elif key in [curses.KEY_RIGHT, ord('d'), ord('D')]:
                new_dir = (0, 1)
            elif key in [curses.KEY_LEFT, ord('a'), ord('A')]:
                new_dir = (0, -1)

            # Prevent 180-degree turns
            if new_dir and (new_dir[0] + self.direction[0] != 0 or new_dir[1] + self.direction[1] != 0):
                self.direction = new_dir

            # Move the snake
            if not self.move():
                self.stdscr.addstr(self.height//2, self.width//2 - 5, "GAME OVER!", curses.A_BOLD)
                self.stdscr.addstr(self.height//2 + 1, self.width//2 - 8, "Press any key...", curses.A_DIM)
                self.stdscr.refresh()
                self.stdscr.nodelay(0)
                self.stdscr.getch()
                break

def main(stdscr):
    curses.curs_set(0)
    curses.start_color()
    curses.init_pair(1, curses.COLOR_CYAN, curses.COLOR_BLACK)
    curses.init_pair(2, curses.COLOR_GREEN, curses.COLOR_BLACK)
    curses.init_pair(3, curses.COLOR_RED, curses.COLOR_BLACK)

    # Check terminal size
    sh, sw = stdscr.getmaxyx()
    if sh < 22 or sw < 42:
        stdscr.addstr(0, 0, f"Terminal too small! Need 42x22, got {sw}x{sh}")
        stdscr.getch()
        return

    game = SnakeGame(stdscr)
    game.run()

if __name__ == "__main__":
    curses.wrapper(main)
