# enemy.py
class Enemy:
    def __init__(self, x):
        self.x = x

    def draw(self, stdscr):
        stdscr.addstr(0, self.x, 'E')

    def move(self):
        self.x -= 1