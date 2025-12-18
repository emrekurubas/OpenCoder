# Space Dodge

A terminal-based arcade game where you pilot a spaceship and dodge incoming asteroids.

## How to Play

```bash
python3 main.py
```

## Controls

| Key | Action |
|-----|--------|
| `UP` / `W` | Move up |
| `DOWN` / `S` | Move down |
| `R` | Restart (after game over) |
| `Q` | Quit |

## Gameplay

- You control a spaceship (`>`) on the left side of the screen
- Asteroids (`*`) spawn from the right and move left
- Dodge the asteroids to survive
- Score increases for each asteroid that passes you
- Difficulty increases as your score grows

## Features

- Color support (green player, red asteroids, yellow score)
- Progressive difficulty
- Score tracking
- Game over screen with restart option

## Requirements

- Python 3.x
- Terminal with curses support
