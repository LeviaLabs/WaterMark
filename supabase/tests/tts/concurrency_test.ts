import assert from "node:assert/strict";

// Explicit opt-in; the database name guard prevents running against project/user databases.
const container = Deno.env.get("TTS_TEST_CONTAINER");
const database = Deno.env.get("TTS_TEST_DATABASE");
Deno.test({
  name: "TTS shared admission serializes simultaneous clients and reserves characters once",
  ignore: !container || !database,
  async fn() {
    if (!container || !database || !/^watermark_tts_test[0-9_]*$/.test(database)) {
      throw new Error("Use a dedicated TTS test database");
    }
    const query = async (sql: string) => {
      const result = await new Deno.Command("docker", {
        args: [
          "exec",
          container,
          "psql",
          "-U",
          "postgres",
          "-d",
          database,
          "-Atq",
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          sql,
        ],
      }).output();
      assert.equal(result.code, 0, new TextDecoder().decode(result.stderr));
      return new TextDecoder().decode(result.stdout).trim();
    };
    // Empty fixture database; different callers contend for the same remaining monthly budget.
    await query(
      "delete from watermark_private.request_budgets where bucket like 'tts:%'; insert into watermark_private.request_budgets values ('tts:month:' || to_char(statement_timestamp() at time zone 'UTC','YYYYMM'),9000,now()+interval '32 days')",
    );
    const outcomes = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        query(
          `set role service_role; select public.watermark_take_tts_budget(md5('test-${i}'),300)`,
        )),
    );
    assert.equal(outcomes.filter((v) => v === "ok").length, 3);
    assert.equal(outcomes.filter((v) => v === "limited").length, 17);
    assert.equal(
      await query(
        "select requests from watermark_private.request_budgets where bucket like 'tts:month:%'",
      ),
      "9900",
    );
    assert.equal(
      await query(
        "select requests from watermark_private.request_budgets where bucket like 'tts:day:%'",
      ),
      "900",
    );
  },
});
