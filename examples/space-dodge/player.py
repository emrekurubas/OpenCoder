# player.py
class Player:
    def __init__(self, max_y):
        self.x = 2
        self.y = max_y // 2
        self.max_y = max_y
        self.symbol = '>'

    def move_up(self):
        if self.y > 1:
            self.y -= 1

    def move_down(self):
        if self.y < self.max_y - 2:
            self.y += 1

    def draw(self, stdscr):
        try:
            stdscr.addstr(self.y, self.x, self.symbol)
        except:
            pass

    def get_position(self):
        return (self.x, self.y)
