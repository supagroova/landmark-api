MOCHA_OPTS= --check-leaks
REPORTER = spec

check: test

test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--no-colors \
		$(MOCHA_OPTS)

test-d:
	@NODE_ENV=test ./node_modules/.bin/mocha debug \
		--reporter $(REPORTER) \
		--no-colors \
		$(MOCHA_OPTS)

test-w:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--no-colors \
		--watch \
		--growl \
		$(MOCHA_OPTS)

test-wd:
	@NODE_ENV=test ./node_modules/.bin/mocha debug \
		--reporter $(REPORTER) \
		--no-colors \
		--watch \
		--growl \
		$(MOCHA_OPTS)

.PHONY: test test-w test-wd