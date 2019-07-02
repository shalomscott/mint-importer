'use strict';

require('dotenv').config();

const fs = require('fs');
const parse = require('csv-parse/lib/sync');
const moment = require('moment');
const pepperMint = require('pepper-mint');
const inquirer = require('inquirer');

const filename = 'transactions.csv';
const csvText = fs.readFileSync(filename, 'utf8');
const records = parse(csvText, {
	columns: true,
	skip_empty_lines: true
});

pepperMint(process.env.EMAIL, process.env.PASS)
	.then(async mint => {
		console.log('Logged into Mint...');

		const categories = await mint.getCategories();
		let tags = await mint.getTags();

		const payees = {};

		for (const record of records) {
			if (record.payee in payees) continue;
			const proceedAnswer = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'proceed',
					message: `Choose a Category and Tags for ${recordToString(record)}?`
				}
			]);
			if (!proceedAnswer.proceed) continue;
			let answers = await inquirer.prompt([
				{
					type: 'list',
					name: 'category',
					message: `Choose a Category:`,
					choices: categories.map(c => c.value),
					default: payees[record.payee] && payees[record.payee].category
				},
				{
					type: 'checkbox',
					name: 'tags',
					message: `Choose a Tags:`,
					choices: selectedTags.map(t => t.value),
					default: payees[record.payee] && payees[record.payee].tags
				}
			]);
			payees[record.payee] = answers;
			const selectedCategory = categories.find(
				c => c.value === answers.category
			);
			record.category = {
				name: selectedCategory.value,
				id: selectedCategory.id
			};
			const selectedTags = answers.tags.map(tag =>
				tags.find(t => t.value === tag)
			);
			record.tags = selectedTags.map(tag => tag.id);
			break;
		}

		console.log(records[0]);
		return mint.createTransaction({
			// accountId: xxxxxx, // apparently ignored, but good to have, I guess?
			amount: records[0].amount,
			category: records[0].category,
			date: moment(records[0].date, 'DD/MM/YYY', true).format('MM/DD/YYY'),
			isExpense: records[0].amount < 0,
			isInvestment: false,
			note: 'This is a test',
			merchant: records[0].payee,
			tags: records[0].tags
		});
	})
	.catch(e => console.error('Error :('));

function recordToString({ date, payee, amount }) {
	return `[${date}: ${payee} - ${amount}]`;
}
