#!/usr/bin/env python3
import curses
from game import main

if __name__ == '__main__':
    curses.wrapper(main)
