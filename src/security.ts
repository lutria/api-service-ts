import { Prisma } from '@prisma/client'

/**
 * Determines if the named model has data security applied to it. The criterion for deciding if data security
 * applies is:
 * - Does the schema for the named model contain a field named 'security' that is of type DataSecurity
 * @param name 
 * @returns true if the named model has data security applied, otherwise false
 */
function isProtectedModel(name: string) {
  const model = Prisma.dmmf.datamodel.models.filter(m => m.name === name)[0]
  return model.fields.filter(f => f.name === 'security' && f.type === 'DataSecurity').length === 1
}

export async function wrapQuery({ model, operation, args, query }: { model: string, operation: string, args: any, query: Function}, privileged: boolean) {
  if (isProtectedModel(model)) {
    if (!privileged) {
      console.log(`Extending query for ${model}.${operation} with security filter`)
      args.where = { ...args.where, security: { protected: false } }
    } else {
      console.log(`Not extending query for ${model}.${operation} with security filter because user is privileged`)
    }
  } else {
    console.log(`Not extending query for ${model}.${operation} because ${model} is not a protected model`)
  }
  
  return query(args)
}

export function forUser({ privileged }: {privileged: boolean }) {
  return Prisma.defineExtension((prisma) => 
    prisma.$extends({ 
      query: {
        $allModels: {
          async findMany(args) {
            return wrapQuery(args, privileged)
          },
          async findUnique(args) {
            return wrapQuery(args, privileged)
          },
          async findUniqueOrThrow(args) {
            return wrapQuery(args, privileged)
          }
        }
      }
    })
  )
}
