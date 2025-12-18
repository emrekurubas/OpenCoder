# game.py
import curses
from time import sleep
from player import Player
from enemy import Enemy

class Game:
    def __init__(self):
        self.player = Player()
        self.enemy = Enemy(curses.COLS - 1)

    def draw(self, stdscr):
        stdscr.clear()
        self.player.draw(stdscr)
        self.enemy.draw(stdscr)
        stdscr.refresh()

    def update(self):
        self.enemy.move()

    def main_loop(self, stdscr):
        while True:
            self.update()
            self.draw(stdscr)
            sleep(0.1)