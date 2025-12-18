# enemy.py
import random


class Asteroid:
    def __init__(self, max_x, max_y):
        self.x = max_x - 1
        self.y = random.randint(1, max_y - 2)
        self.symbol = '*'
        self.speed = random.randint(1, 2)

    def move(self):
        self.x -= self.speed

    def is_off_screen(self):
        return self.x < 0

    def draw(self, stdscr):
        try:
            stdscr.addstr(self.y, self.x, self.symbol)
        except:
            pass

    def get_position(self):
        return (self.x, self.y)

    def collides_with(self, player_x, player_y):
        return self.x == player_x and self.y == player_y
