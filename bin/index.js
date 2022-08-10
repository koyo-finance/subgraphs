const { Command } = require('commander');
const { exec } = require('child_process');

const program = new Command();

program
	.command('prepare')
	.arguments('<subgraph> <network>')
	.action((subgraph, network) => {
		console.log('prepare command called', { subgraph, network });
		exec(`node_modules/.bin/mustache config/${network}.js subgraphs/${subgraph}/template.yaml > subgraphs/${subgraph}/subgraph.yaml`);
		exec(
			`node_modules/.bin/mustache config/${network}.js subgraphs/${subgraph}/src/constants/addresses.template.ts > subgraphs/${subgraph}/src/constants/addresses.ts`
		);
	});

program
	.command('deploy')
	.arguments('<subgraph> <network>')
	.action((subgraph, network) => {
		console.log('deploy command called', { subgraph, network });
		exec(`node_modules/.bin/mustache config/${network}.js subgraphs/${subgraph}/template.yaml > subgraphs/${subgraph}/subgraph.yaml`).stdout.pipe(
			process.stdout
		);
		exec(
			`node_modules/.bin/mustache config/${network}.js subgraphs/${subgraph}/src/constants/addresses.template.ts > subgraphs/${subgraph}/src/constants/addresses.ts`
		).stdout.pipe(process.stdout);
		exec(`cd subgraphs/${subgraph} && ../../node_modules/.bin/graph codegen`).stdout.pipe(process.stdout);
		exec(`node_modules/.bin/graph build subgraphs/${subgraph}/subgraph.yaml`).stdout.pipe(process.stdout);
		exec(
			`node_modules/.bin/graph deploy --product hosted-service koyo-finance/${subgraph}-${network} subgraphs/${subgraph}/subgraph.yaml`
		).stdout.pipe(process.stdout);
	});

program
	.command('log')
	.arguments('<subgraphName>')
	.option('-v, --version <version>', 'Which version to get logs for', 'pending')
	// eslint-disable-next-line @typescript-eslint/default-param-last
	.action((subgraphName = 'koyo-finance/momiji', options) => {
		const method = {
			current: 'indexingStatusForCurrentVersion',
			pending: 'indexingStatusForPendingVersion'
		};

		exec(
			`curl --location --request POST 'https://api.thegraph.com/index-node/graphql' --data '{"query":"{ ${
				method[options.version]
			}(subgraphName: \\"${subgraphName}\\") { subgraph synced fatalError { message } nonFatalErrors { message } } }"}'`
		).stdout.pipe(process.stdout);
	});

program.parse(process.argv);
