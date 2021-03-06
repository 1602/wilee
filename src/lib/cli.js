import { readFileSync } from 'fs'
import { normalize } from 'path'
import { inspect } from './util'

import moment from 'moment'
import yargs from 'yargs'

import Account from './Account'
import { newReg, newAuthz, newCert } from 'glob:../commands/*.js'
import Client from './Client'

const stagingUri = 'https://acme-staging.api.letsencrypt.org/directory'

var argv = yargs.usage('Usage: $0 [global options] <command> [options]')
  .strict()
  .options({
    'account': {
      alias: 'a',
      demand: true,
      describe: 'File location of the RSA private key which should be used as the Account Key (in PEM format)',
      global: true,
      group: 'Global options:',
      nargs: 1,
      normalize: true,
      string: true
    },
    'directory': {
      alias: 'd',
      default: stagingUri,
      describe: 'URI of the directory resource on the ACME server',
      global: true,
      group: 'Global options:',
      nargs: 1,
      string: true
    }
  })
  .command(
    'new-reg <email>',
    'Create a new registration for the account key',
    (yargs) => {
      return yargs.usage(`Usage: $0 [global options] new-reg <email> [options]

Provide the email address you wish the ACME server to contact you on if necessary.`)
        .example('$0 --account account.pem new-reg example@example.com', 'Register your account with example@example.com as the contact address')
    },
    (argv) => {
      argv.run = (account, client) => newReg(account, client, argv.email)
    }
  )
  .command(
    'new-authz <domain>',
    'Authorize a domain name identifier',
    (yargs) => {
      return yargs.usage(`Usage: $0 [global options] new-authz <domain> [options]

Pass the domain name you wish to authorize your account for.`)
        .example('$0 --account account.pem new-authz example.com', 'Authorize your account for example.com')
    },
    (argv) => {
      argv.run = (account, client) => newAuthz(account, client, argv.domain)
    }
  )
  .command(
    'new-cert <csr>',
    'Submit a certificate signing request',
    (yargs) => {
      const now = moment.utc()

      return yargs.usage(`Usage: $0 [global options] new-cert <csr> [options]

Submit a certificate signing request. The CSR file must be in DER format.

Your account must have previously been authorized for the domains included in
the certificate. Other restrictions may apply, depending on the ACME server.

--not-before and --not-after may be ignored by ACME servers.`)
      .options({
        'not-before': {
          default: now.format(),
          defaultDescription: 'Time when the certificate is requested',
          describe: 'ISO8601-formatted timestamp to restrict when the certificate becomes valid',
          nargs: 1,
          string: true
        },
        'not-after': {
          default: now.add(90, 'days').format(),
          defaultDescription: '90 days after the certificate is requested',
          describe: 'ISO8601-formatted timestamp to restrict when the certificate ceases to be valid',
          nargs: 1,
          string: true
        },
        'out': {
          alias: 'o',
          describe: 'If provided, the path the certificate should be written to',
          nargs: 1,
          normalize: true,
          string: true
        }
      })
      .example('$0 --account account.pem new-cert csr.der -o cert.der')
    },
    (argv) => {
      argv.run = (account, client) => newCert(account, client, normalize(argv.csr), argv.out, argv['not-after'], argv['not-before'])
    }
  )
  .demand(1)
  .help()
  .epilog('Find more usage information at https://github.com/novemberborn/wilee')
  .argv

if (argv.directory === stagingUri) {
  console.error(`
NOTICE: Using the staging server provided by Letsencrypt.
        No valid certificates will be issued.
`)
}

const account = new Account(readFileSync(argv.account, 'ascii'))
const client = new Client(account, argv.directory)

argv.run(account, client).catch((err) => {
  console.error(err && err.stack || err)
  for (const k in err) {
    console.error(`${k}: ${inspect(err[k])}`)
  }
  return 1
}).then((code = 0) => process.exit(code))
