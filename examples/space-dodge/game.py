# game.py
import curses
import random
from player import Player
from enemy import Asteroid


class Game:
    def __init__(self, stdscr):
        self.stdscr = stdscr
        self.max_y, self.max_x = stdscr.getmaxyx()
        self.player = Player(self.max_y)
        self.asteroids = []
        self.score = 0
        self.game_over = False
        self.spawn_rate = 5
        self.frame_count = 0
        self.difficulty_increase = 100

        curses.curs_set(0)
        stdscr.nodelay(True)
        stdscr.timeout(100)

        if curses.has_colors():
            curses.start_color()
            curses.init_pair(1, curses.COLOR_GREEN, curses.COLOR_BLACK)
            curses.init_pair(2, curses.COLOR_RED, curses.COLOR_BLACK)
            curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)
            curses.init_pair(4, curses.COLOR_CYAN, curses.COLOR_BLACK)

    def spawn_asteroid(self):
        self.asteroids.append(Asteroid(self.max_x, self.max_y))

    def update(self):
        self.frame_count += 1

        current_spawn_rate = max(2, self.spawn_rate - (self.score // self.difficulty_increase))
        if self.frame_count % current_spawn_rate == 0:
            self.spawn_asteroid()

        for asteroid in self.asteroids:
            asteroid.move()

        old_count = len(self.asteroids)
        self.asteroids = [a for a in self.asteroids if not a.is_off_screen()]
        self.score += (old_count - len(self.asteroids))

        player_x, player_y = self.player.get_position()
        for asteroid in self.asteroids:
            if asteroid.collides_with(player_x, player_y):
                self.game_over = True
                return

    def draw(self):
        self.stdscr.clear()

        if curses.has_colors():
            self.stdscr.attron(curses.color_pair(4))
        for x in range(self.max_x - 1):
            try:
                self.stdscr.addch(0, x, '-')
                self.stdscr.addch(self.max_y - 1, x, '-')
            except:
                pass
        if curses.has_colors():
            self.stdscr.attroff(curses.color_pair(4))

        score_text = f" SCORE: {self.score} "
        if curses.has_colors():
            self.stdscr.attron(curses.color_pair(3))
        try:
            self.stdscr.addstr(0, 2, score_text)
        except:
            pass
        if curses.has_colors():
            self.stdscr.attroff(curses.color_pair(3))

        if curses.has_colors():
            self.stdscr.attron(curses.color_pair(2))
        for asteroid in self.asteroids:
            asteroid.draw(self.stdscr)
        if curses.has_colors():
            self.stdscr.attroff(curses.color_pair(2))

        if curses.has_colors():
            self.stdscr.attron(curses.color_pair(1))
        self.player.draw(self.stdscr)
        if curses.has_colors():
            self.stdscr.attroff(curses.color_pair(1))

        try:
            self.stdscr.addstr(self.max_y - 1, 2, " [UP/DOWN: Move] [Q: Quit] ")
        except:
            pass

        self.stdscr.refresh()

    def draw_game_over(self):
        self.stdscr.clear()
        center_y = self.max_y // 2
        center_x = self.max_x // 2

        messages = ["GAME OVER", f"Final Score: {self.score}", "", "Press 'R' to Restart", "Press 'Q' to Quit"]

        for i, msg in enumerate(messages):
            x = center_x - len(msg) // 2
            y = center_y - len(messages) // 2 + i
            try:
                if i == 0 and curses.has_colors():
                    self.stdscr.attron(curses.color_pair(2))
                    self.stdscr.addstr(y, x, msg)
                    self.stdscr.attroff(curses.color_pair(2))
                elif i == 1 and curses.has_colors():
                    self.stdscr.attron(curses.color_pair(3))
                    self.stdscr.addstr(y, x, msg)
                    self.stdscr.attroff(curses.color_pair(3))
                else:
                    self.stdscr.addstr(y, x, msg)
            except:
                pass

        self.stdscr.refresh()

    def reset(self):
        self.player = Player(self.max_y)
        self.asteroids = []
        self.score = 0
        self.game_over = False
        self.frame_count = 0

    def handle_input(self):
        try:
            key = self.stdscr.getch()
        except:
            return True

        if key == ord('q') or key == ord('Q'):
            return False
        elif key == curses.KEY_UP or key == ord('w') or key == ord('W'):
            self.player.move_up()
        elif key == curses.KEY_DOWN or key == ord('s') or key == ord('S'):
            self.player.move_down()
        elif key == ord('r') or key == ord('R'):
            if self.game_over:
                self.reset()

        return True

    def run(self):
        running = True
        while running:
            running = self.handle_input()
            if not self.game_over:
                self.update()
                self.draw()
            else:
                self.draw_game_over()


def main(stdscr):
    Game(stdscr).run()
