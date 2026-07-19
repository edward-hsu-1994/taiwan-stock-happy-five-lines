.PHONY: install dev build preview lint job-install fetch backfill clean

install:
	npm install

dev:
	npm run dev

build:
	npm run build

preview:
	npm run preview

lint:
	npm run lint

job-install:
	python3 -m pip install -r job/requirements.txt

fetch:
	python3 job/fetch_stock_prices.py --mode latest

backfill:
	python3 job/fetch_stock_prices.py --mode backfill --start-date "$(START_DATE)" --end-date "$(END_DATE)"

clean:
	rm -rf dist node_modules/.tmp
