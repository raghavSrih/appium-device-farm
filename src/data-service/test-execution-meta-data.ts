import { prisma } from '../prisma';
import log from '../logger';

async function createTestEventInDB(testMetaData: any) {
  try {
    await prisma.testEventJournal.create({
      data: {
        event_type: testMetaData.test_run.type,
        event_sub_type: testMetaData.test_run.type,
        session_id: testMetaData.test_run.integrations.unknown_grid.session_id,
        event_uuid: testMetaData.test_run.uuid,
        name: testMetaData.test_run.name,
        scopes: JSON.stringify(testMetaData.test_run.scopes),
        result: testMetaData.test_run.result,
        started_at: testMetaData.test_run.started_at,
        finished_at: null,
        start_event_doc: JSON.stringify(testMetaData),
        finished_event_doc: null,
        file: testMetaData.test_run.file_name,
      },
    });
    log.info('TestRunStarted event is saved to DB');
  } catch (e) {
    log.error(`TestRunStarted event processing Failed  -- ${e}`);
    throw e;
  }
}

async function updateTestEventInDB(testMetaData: any) {
  try {
    await prisma.testEventJournal.update({
      where: {
        event_uuid: testMetaData.test_run.uuid,
      },
      data: {
        result: testMetaData.test_run.result,
        finished_at: testMetaData.test_run.started_at,
        finished_event_doc: JSON.stringify(testMetaData),
        hooks: JSON.stringify(testMetaData.test_run.hooks)
      },
    });
    log.info('TestRunFinished event is saved to DB');
  } catch (e) {
    log.error(`TestRunFinished event processing Failed  -- ${e}`);
    throw e;
  }
}

async function createHookEventInDB(testMetaData: any) {
  try {
    await prisma.testEventJournal.create({
      data: {
        event_type: testMetaData.hook_run.type,
        event_sub_type: testMetaData.hook_run.hook_type,
        session_id: testMetaData.hook_run.integrations.unknown_grid.session_id,
        event_uuid: testMetaData.hook_run.uuid,
        name: testMetaData.hook_run.name,
        scopes: JSON.stringify(testMetaData.hook_run.scopes),
        result: testMetaData.hook_run.result,
        started_at: testMetaData.hook_run.started_at,
        finished_at: null,
        start_event_doc: JSON.stringify(testMetaData),
        finished_event_doc: null,
        file: testMetaData.hook_run.file_name,
      },
    });
    log.info('HookRunStarted event is saved to DB');
  } catch (e) {
    log.error(`HookRunStarted event processing Failed  -- ${e}`);
    throw e;
  }
}

async function updateHookEventInDB(testMetaData: any) {
  const hook = testMetaData.hook_run.test_run_id?JSON.stringify([testMetaData.hook_run.test_run_id]): null;
  try {
    await prisma.testEventJournal.update({
      where: {
        event_uuid: testMetaData.hook_run.uuid,
      },
      data: {
        result: testMetaData.hook_run.result,
        finished_at: testMetaData.hook_run.started_at,
        finished_event_doc: JSON.stringify(testMetaData),
        hooks: hook
      },
    });
    log.info('HookRunFinished event is saved to DB');
  } catch (e) {
    log.error(`HookRunFinished event processing Failed  -- ${e}`);
    throw e;
  }
}

async function runRawQuery(query:string): Promise<Record<string, any>> {
  return await prisma.$queryRaw`${query}`;
}

async function getBuildData(buildId: string): Promise<Record<string, any>> {
  try {
    return await prisma.$queryRaw`
      select b.id, t.session_id, t.event_sub_type, t.name, t.scopes, t.result, t.event_uuid,  t.started_at, t.finished_at, t.file, t.hooks
      from Build b
      inner join session s
      on b.id = s.build_id
      inner join TestEventJournal t
      on s.id = t.session_id
      where b.id = ${buildId} and ( LOWER(t.event_type) = 'test' or t.event_sub_type='BEFORE_ALL' or t.event_sub_type='AFTER_ALL')
      order by t.started_at asc`;
  } catch (e) {
    console.error(`Failed to fetch the test execution data for build ${buildId}`);
    throw e;
  }
}

async function getSessionLog(eventId: string) {
  try {
    return await prisma.$queryRaw`select *
    from SessionLog
    where eventId = ${eventId}
    order by created_at asc`;
  } catch (e) {
    console.error(`Failed to fetch the sessionLog for eventId = ${eventId}`);
    throw e;
  }
}

async function getTestExecutionData(testId:string) {
  let testEvents: Record<string, any>[] = [];
  try {
      const result: Record<string, any> = await prisma.$queryRaw`select t.event_uuid, t.event_sub_type, t.session_id, t.result, t.started_at, t.finished_at
      from TestEventJournal t
      where t.event_uuid = ${testId}
      order by t.started_at asc`;
      if(result.length > 0) {
        const event = result[0];
        event["log"] = await getSessionLog(event.event_uuid);
        testEvents.push(event);
      }
    return testEvents;
  } catch (e) {
    console.error(`Failed to fetch the test data for ${testId}`);
    throw e;
  }
}

async function getBeforeEachHooks(testId: string){
  let hookEvents: Record<string, any>[] = [];
  try {
    const data: Record<string, any>[] = await prisma.$queryRaw`select t.hooks
    from TestEventJournal t
    where t.event_uuid = ${testId}
    order by t.started_at asc`;

    const beforeHooks = JSON.parse(data[0].hooks);
    for(const hook of beforeHooks){
      const result: Record<string, any> = await prisma.$queryRaw`select t.event_uuid, t.event_sub_type, t.session_id, t.result, t.started_at, t.finished_at
      from TestEventJournal t
      where t.event_uuid = ${hook} and event_sub_type != "BEFORE_ALL"
      order by t.started_at asc`;
      if(result.length > 0) {
        const event = result[0];
        event["log"] = await getSessionLog(event.event_uuid);
        hookEvents.push(event);
      }
    };
    return hookEvents;
  } catch (e) {
    console.error(`Failed to fetch Before Each Hooks data for test id ${testId}`);
    throw e;
  }
}

async function getAfterEachHookData(testId: string) {
  testId = `%${testId}%`;
  try{
    const hookEvents: Record<string, any>[] = await prisma.$queryRaw`select t.event_uuid, t.event_sub_type, t.session_id, t.result, t.started_at, t.finished_at
    from TestEventJournal t
    where t.hooks like ${testId} and t.event_sub_type != 'AFTER_ALL'
    order by t.started_at asc`;  
    for(const hook of hookEvents){
      hook["log"] = await getSessionLog(hook.event_uuid);
    }
    return hookEvents;
  } catch(err){
    console.error(`Failed to fetch After All Hook data from test Id ${testId}`);
    console.error(`${err}`);
    throw err
  }  
}

export {
  createTestEventInDB,
  updateTestEventInDB,
  createHookEventInDB,
  updateHookEventInDB,
  getBuildData,
  getAfterEachHookData,
  getTestExecutionData,
  getBeforeEachHooks
};
