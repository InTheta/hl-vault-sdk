# Security policy

This SDK is pre-1.0 and the associated platform has not completed its public
launch security gates. Do not use it to custody production funds.

Report suspected vulnerabilities through the repository's **Security → Report
a vulnerability** private-advisory flow. Do not include credentials, private
keys, bearer tokens, wallet signatures or non-public deployment details in a
public issue.

The SDK must never receive a vault agent private key. Browser applications must
use wallet-signed short sessions; bot bearer tokens belong only in server-side
secret storage.
