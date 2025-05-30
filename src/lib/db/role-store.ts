import type EventEmitter from 'events';
import type { Logger, LogProvider } from '../logger.js';
import NotFoundError from '../error/notfound-error.js';
import type { ICustomRole } from '../types/model.js';
import type {
    ICustomRoleInsert,
    ICustomRoleUpdate,
    IRoleStore,
} from '../types/stores/role-store.js';
import type { IRole, IUserRole } from '../types/stores/access-store.js';
import type { Db } from './db.js';
import { PROJECT_ROLE_TYPES, ROOT_ROLE_TYPES } from '../util/index.js';
import type { RoleSchema } from '../openapi/index.js';

const T = {
    ROLE_USER: 'role_user',
    GROUP_ROLE: 'group_role',
    ROLES: 'roles',
};

const COLUMNS = ['id', 'name', 'description', 'type'];

interface IRoleRow {
    id: number;
    name: string;
    description: string;
    type: string;
}

export default class RoleStore implements IRoleStore {
    private logger: Logger;

    private eventBus: EventEmitter;

    private db: Db;

    constructor(db: Db, eventBus: EventEmitter, getLogger: LogProvider) {
        this.db = db;
        this.eventBus = eventBus;
        this.logger = getLogger('lib/db/role-store.ts');
    }

    async getAll(): Promise<ICustomRole[]> {
        const rows = await this.db
            .select(COLUMNS)
            .from(T.ROLES)
            .orderBy('name', 'asc');

        return rows.map(this.mapRow);
    }

    async count(): Promise<number> {
        return this.db
            .from(T.ROLES)
            .count('*')
            .then((res) => Number(res[0].count));
    }

    async filteredCount(filter: Partial<RoleSchema>): Promise<number> {
        return this.db
            .from(T.ROLES)
            .count('*')
            .where(filter)
            .then((res) => Number(res[0].count));
    }

    async filteredCountInUse(filter: Partial<RoleSchema>): Promise<number> {
        return this.db
            .from(T.ROLES)
            .countDistinct('roles.id')
            .leftJoin('role_user as ru', 'roles.id', 'ru.role_id')
            .leftJoin('groups as g', 'roles.id', 'g.root_role_id')
            .where(filter)
            .andWhere((qb) =>
                qb.whereNotNull('ru.role_id').orWhereNotNull('g.root_role_id'),
            )
            .then((res) => Number(res[0].count));
    }

    async create(role: ICustomRoleInsert): Promise<ICustomRole> {
        const row = await this.db(T.ROLES)
            .insert({
                name: role.name,
                description: role.description,
                type: role.roleType,
            })
            .returning('*');
        return this.mapRow(row[0]);
    }

    async delete(id: number): Promise<void> {
        return this.db(T.ROLES).where({ id }).del();
    }

    async get(id: number): Promise<ICustomRole> {
        const rows = await this.db.select(COLUMNS).from(T.ROLES).where({ id });
        if (rows.length === 0) {
            throw new NotFoundError(`Could not find role with id: ${id}`);
        }
        return this.mapRow(rows[0]);
    }

    async update(role: ICustomRoleUpdate): Promise<ICustomRole> {
        const rows = await this.db(T.ROLES)
            .where({
                id: role.id,
            })
            .update({
                id: role.id,
                name: role.name,
                description: role.description,
            })
            .returning('*');
        return this.mapRow(rows[0]);
    }

    async exists(id: number): Promise<boolean> {
        const result = await this.db.raw(
            `SELECT EXISTS (SELECT 1 FROM ${T.ROLES} WHERE id = ?) AS present`,
            [id],
        );
        const { present } = result.rows[0];
        return present;
    }

    async nameInUse(name: string, existingId?: number): Promise<boolean> {
        let query = this.db(T.ROLES).where({ name }).returning('id');
        if (existingId) {
            query = query.andWhereNot({ id: existingId });
        }
        const result = await query;
        return result.length > 0;
    }

    async deleteAll(): Promise<void> {
        return this.db(T.ROLES).del();
    }

    mapRow(row: IRoleRow): ICustomRole {
        if (!row) {
            throw new NotFoundError('No row');
        }

        return {
            id: row.id,
            name: row.name,
            description: row.description,
            type: row.type,
        };
    }

    async getRoles(): Promise<IRole[]> {
        return this.db
            .select(['id', 'name', 'type', 'description'])
            .from<IRole>(T.ROLES);
    }

    async getRoleWithId(id: number): Promise<IRole> {
        return this.db
            .select(['id', 'name', 'type', 'description'])
            .where('id', id)
            .first()
            .from<IRole>(T.ROLES);
    }

    async getProjectRoles(): Promise<IRole[]> {
        return this.db
            .select(['id', 'name', 'type', 'description'])
            .from<IRole>(T.ROLES)
            .whereIn('type', PROJECT_ROLE_TYPES);
    }

    async getRolesForProject(projectId: string): Promise<IRole[]> {
        return this.db
            .select(['r.id', 'r.name', 'r.type', 'ru.project', 'r.description'])
            .from<IRole>(`${T.ROLE_USER} as ru`)
            .innerJoin(`${T.ROLES} as r`, 'ru.role_id', 'r.id')
            .where('project', projectId);
    }

    async getRootRoles(): Promise<IRole[]> {
        return this.db
            .select(['id', 'name', 'type', 'description'])
            .from<IRole>(T.ROLES)
            .whereIn('type', ROOT_ROLE_TYPES);
    }

    async removeRolesForProject(projectId: string): Promise<void> {
        return this.db(T.ROLE_USER)
            .where({
                project: projectId,
            })
            .delete();
    }

    async getRootRoleForAllUsers(): Promise<IUserRole[]> {
        const rows = await this.db
            .select('id', 'user_id')
            .distinctOn('user_id')
            .from(`${T.ROLES} AS r`)
            .leftJoin(`${T.ROLE_USER} AS ru`, 'r.id', 'ru.role_id')
            .whereIn('r.type', ROOT_ROLE_TYPES);

        return rows.map((row) => ({
            roleId: Number(row.id),
            userId: Number(row.user_id),
        }));
    }

    async getRoleByName(name: string): Promise<IRole> {
        return this.db(T.ROLES).where({ name }).first();
    }

    destroy(): void {}
}
