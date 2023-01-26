# api-service

## Setup hostname alias for Mongo replicaset connection

This will add an entry to
`/etc/hosts` in the container that maps the hostname `mongo` to the tailnet IP of the host that Mongo is
running on:

```shell
sudo ./scripts/set-host-alias.sh <tailnet_hostname> mongo
```

## Prisma schema commands
```shell
npx prisma format
```

```shell
npx prisma generate
```
