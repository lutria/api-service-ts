import { Prisma } from "@prisma/client";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL });

/**
 * Determines if the named model has data security applied to it. The criterion for deciding if data security
 * applies is:
 * - Does the schema for the named model contain a field named 'security' that is of type DataSecurity
 * @param name
 * @returns true if the named model has data security applied, otherwise false
 */
function isProtectedModel(name) {
  const model = Prisma.dmmf.datamodel.models.filter((m) => m.name === name)[0];
  return (
    model.fields.filter(
      (f) => f.name === "security" && f.type === "DataSecurity"
    ).length === 1
  );
}

export async function wrapQuery({ model, operation, args, query }, privileged) {
  if (isProtectedModel(model)) {
    if (!privileged) {
      logger.debug(
        `Extending query for ${model}.${operation} with security filter`
      );

      const securityFilter = {
        security: {
          is: {
            protected: false,
          },
        },
      };

      if (args.where) {
        if (args.where && "AND" in args.where) {
          args.where = {
            AND: [
              ...args.where.AND,
              {
                ...securityFilter,
              },
            ],
          };
        } else if ("OR" in args.where) {
          args.where = {
            AND: [
              {
                OR: args.where.OR,
              },
              {
                ...securityFilter,
              },
            ],
          };
        } else if ("NOT" in args.where) {
          args.where = {
            AND: [
              {
                NOT: args.where.NOT,
              },
              {
                ...securityFilter,
              },
            ],
          };
        } else {
          args.where = {
            ...args.where,
            ...securityFilter,
          };
        }
      } else {
        args.where = {
          ...securityFilter,
        };
      }

      logger.trace(args.where);
    } else {
      logger.debug(
        `Not extending query for ${model}.${operation} with security filter because user is privileged`
      );
    }
  } else {
    logger.debug(
      `Not extending query for ${model}.${operation} because ${model} is not a protected model`
    );
  }

  return query(args);
}

export function forUser({ privileged }) {
  return Prisma.defineExtension((prisma) =>
    prisma.$extends({
      query: {
        $allModels: {
          async findMany(args) {
            return wrapQuery(args, privileged);
          },
          async findUnique(args) {
            return wrapQuery(args, privileged);
          },
          async findUniqueOrThrow(args) {
            return wrapQuery(args, privileged);
          },
        },
      },
    })
  );
}
