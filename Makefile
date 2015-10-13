# Naming our phony targets
.PHONY: install test build clean

install:
	git pull
	npm install --production

build:
	@bash tools/build-tar.sh

build-private:
	@bash tools/build-tar.sh --private

clean:
	rm -fr node_modules/