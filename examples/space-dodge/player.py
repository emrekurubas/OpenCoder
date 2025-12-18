# player.py
class Player:
    def __init__(self, x=0):
        self.x = x

    def draw(self, stdscr):
        stdscr.addstr(0, self.x, 'A')