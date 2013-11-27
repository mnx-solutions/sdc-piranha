# Naming our phony targets
.PHONY: install test build clean

install:
	git pull
	npm install --production

build:
	node tools/build-tar.js --debug --skip-tags --skip-package

clean:
	rm -fr node_modules/