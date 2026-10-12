PY ?= python3
VENV := .venv

.PHONY: all setup narration music video clean

all: narration music video

setup:
	$(PY) -m venv $(VENV)
	$(VENV)/bin/pip install -q espeakng-loader numpy
	cd composer && npm install

narration:          ## Turkish narration + caption timeline
	$(VENV)/bin/python scripts/build_narration.py --rate 186

music:              ## locally synthesized ambient bed + ducked mix
	$(VENV)/bin/python scripts/build_music.py

video:              ## Remotion render -> renders/final.mp4
	bash scripts/render.sh

clean:
	rm -rf audio/*.wav build/stills* build/contact*.png renders/*.mp4
