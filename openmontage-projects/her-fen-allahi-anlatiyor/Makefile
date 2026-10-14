PY ?= python3
VENV := .venv

.PHONY: all setup narration music video clean

all: narration music video

setup:
	$(PY) -m venv $(VENV)
	$(VENV)/bin/pip install -q espeakng-loader numpy
	cd composer && npm install

narration:          ## Turkish narration + caption timeline
	$(VENV)/bin/python ../toolkit/build_narration.py --project . --voice ema

music:              ## locally synthesized ambient bed + ducked mix
	$(VENV)/bin/python ../toolkit/build_music.py --project .

video:              ## Remotion render -> renders/final.mp4
	bash scripts/render.sh

clean:
	rm -rf audio/*.wav build/stills* build/contact*.png renders/*.mp4
