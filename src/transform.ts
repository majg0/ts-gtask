import { L, O, U } from "ts-toolbelt";
import { Tail } from "ts-toolbelt/out/List/Tail";
import { ZipObj } from "ts-toolbelt/out/List/ZipObj";

export function wrap<
  Args extends unknown[],
  Result,
  Name extends string,
  Names extends readonly string[]
>(
  name: Name,
  f: (...args: Args) => Promise<Result>,
  ...names: Names
): (args: ZipObj<Names, Args>) => Promise<{ [key in Name]: Result }> {
  return async (args) => {
    return {
      [name]: await f(...(names.map((n) => (args as any)[n]) as any)),
    } as any;
  };
}

export type GTask<Args, Result> = (args: Args) => Promise<Result>;
export type TTup = GTask<any, any>[];

export type GTaskArgs<G extends TTup> = G[0] extends undefined
  ? []
  : G[0] extends GTask<infer A, any>
  ? [A, ...GTaskArgs<Tail<G>>]
  : never;

export type GTaskArgsObjects<G extends TTup> = G[0] extends undefined
  ? []
  : G[0] extends GTask<infer A, any>
  ? A extends O.Object
    ? [A, ...GTaskArgs<Tail<G>>]
    : never
  : never;

export type GTaskResults<G extends TTup> = G[0] extends undefined
  ? []
  : G[0] extends GTask<any, infer R>
  ? [R, ...GTaskResults<Tail<G>>]
  : never;

export type GTaskResultObjects<G extends TTup> = G[0] extends undefined
  ? []
  : G[0] extends GTask<any, infer R>
  ? R extends O.Object
    ? [R, ...GTaskResults<Tail<G>>]
    : never
  : never;

export type GTaskMergedArgs<G extends TTup> = ListToIntersection<GTaskArgs<G>>;
export type GTaskMergedResult<G extends TTup> = ListToIntersection<
  GTaskResults<G>
>;

export type ListToIntersection<X extends L.List<any>> = U.IntersectOf<
  L.UnionOf<X>
>;

export type MergedGTask<G extends TTup> = GTask<
  GTaskMergedArgs<G>,
  GTaskMergedResult<G>
>;

export function par<G extends TTup>(...tasks: G): MergedGTask<G> {
  return async (args) => {
    const results = await Promise.all(tasks.map((t) => t(args)));
    return Object.assign({}, ...results);
  };
}

export function seq<G extends TTup>(...tasks: G): MergedGTask<G> {
  return async (args) => {
    let result = {};
    for (const t of tasks) {
      result = Object.assign(result, await t(args));
    }
    return result as any;
  };
}

export type GTaskMergedInput<G extends TTup> = O.Exclude<
  O.MergeAll<{}, GTaskArgsObjects<G>>,
  O.MergeAll<{}, GTaskResultObjects<G>>
>;

export function flow<G extends TTup>(
  ...tasks: G
): GTask<GTaskMergedInput<G>, GTaskMergedResult<G>> {
  return async (args) => {
    let o = args;
    for (const t of tasks) {
      o = { ...o, ...(await t(o as any)) };
    }
    return o as any;
  };
}
