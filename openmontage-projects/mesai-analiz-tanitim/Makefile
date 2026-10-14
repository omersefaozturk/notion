VENV ?= ../her-fen-allahi-anlatiyor/.venv
EMA_WEIGHTS_DIR ?= $(abspath ../her-fen-allahi-anlatiyor/models/ema)
TOOLKIT := ../toolkit

.PHONY: all capture narration music video clean

all: capture narration music video

capture:            ## drive the real page in Chromium, save shots + boxes
	$(VENV)/bin/python scripts/capture.py

narration:          ## EMA Lightning narration + caption timeline
	EMA_WEIGHTS_DIR=$(EMA_WEIGHTS_DIR) $(VENV)/bin/python $(TOOLKIT)/build_narration.py --project . --voice ema

music:              ## ambient bed, well behind the voice
	$(VENV)/bin/python $(TOOLKIT)/build_music.py --project . --bed-level 0.34

video:              ## Remotion render -> renders/final.mp4
	bash scripts/render.sh

clean:
	rm -rf audio/*.wav build/stills* build/*_sheet.png renders/*.mp4
