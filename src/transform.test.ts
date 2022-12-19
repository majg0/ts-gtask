import { flow, par, seq, wrap } from "./transform";

describe("tests", () => {
  it("run", () => {});
});

interface User {
  name: string;
  age: number;
}

interface FolderInfo {
  path: string;
  files: string[];
}

async function readUser(): Promise<User> {
  return {
    name: "mg",
    age: 30,
  };
}

async function getFolderInfo(path: string): Promise<FolderInfo> {
  return { path, files: ["a.foo", "b.foo"] };
}

async function ensureWriteAccess(
  user: User,
  folderInfo: FolderInfo
): Promise<boolean> {
  if (folderInfo.path !== `/user/${user.name}`) {
    throw new Error("No write access");
  }
  return true;
}

async function uploadToFolder(
  user: User,
  folderInfo: FolderInfo,
  files: string[]
): Promise<string> {
  return `${user.name} wrote ${files.length} files into ${folderInfo.path}`;
}

describe("transform", () => {
  describe("wrap", () => {
    it.each([
      ["foo", async () => 1, [], {}, 1],
      ["bar", async (a: number) => a + 1, ["a"], { a: 2 }, 3],
      [
        "baz",
        async (a: number, b: string) => a + b.length + 1,
        ["a", "b"],
        { a: 2, b: "wut" },
        6,
      ],
    ])(
      "converts async functions to GTasks",
      (name, f, argNames, args, result) => {
        expect(
          wrap(
            name,
            f as <Args extends any[]>(...args: Args) => Promise<number>,
            ...argNames
          )(args)
        ).resolves.toStrictEqual({
          [name]: result,
        });
      }
    );
  });

  describe("par", () => {
    it("makes GTasks run in parallel", async () => {
      jest.useFakeTimers();
      async function foo(timeout: number): Promise<Date> {
        return new Promise((resolve) => {
          const startTime = new Date();
          setTimeout(() => resolve(startTime), timeout);
        });
      }

      const f = par(wrap("t1", foo, "timeout1"), wrap("t2", foo, "timeout2"));
      const p = f({ timeout1: 500, timeout2: 1e3 });
      jest.runAllTimers();
      const { t1, t2 } = await p;
      expect(t1.valueOf() - t2.valueOf()).toBeCloseTo(0);
    });
  });

  describe("seq", () => {
    it("makes GTasks run in sequence", async () => {
      jest.useFakeTimers();
      async function foo(timeout: number): Promise<Date> {
        return new Promise((resolve) => {
          const startTime = new Date();
          setTimeout(() => resolve(startTime), timeout);
        });
      }

      const f = seq(wrap("t1", foo, "timeout1"), wrap("t2", foo, "timeout2"));
      const delay = 20e3;
      const p = f({ timeout1: delay, timeout2: 1e3 });
      console.log("a");
      await Promise.resolve();
      jest.runAllTimers();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      console.log("f");
      jest.runAllTimers();
      const { t1, t2 } = await p;
      expect(t2.valueOf() - t1.valueOf()).toBeCloseTo(delay);
    });
  });

  it("composes", async () => {
    const f = flow(
      par(wrap("user", readUser), wrap("folderInfo", getFolderInfo, "path")),
      wrap("hasWriteAccess", ensureWriteAccess, "user", "folderInfo"),
      wrap("result", uploadToFolder, "user", "folderInfo", "files")
    );
    const o = await f({
      path: "/user/mg",
      files: ["a", "b"],
    });
    console.log(o.result);
  });
});
