import log from '../logger';
import { Request } from 'express';
import {
  createHookEventInDB,
  createTestEventInDB,
  getBuildData,
  updateHookEventInDB,
  updateTestEventInDB,
} from '../data-service/test-execution-meta-data';

enum TestEvent {
  TestRunStarted = 'TestRunStarted',
  TestRunFinished = 'TestRunFinished',
  HookRunFinished = 'HookRunFinished',
  HookRunStarted = 'HookRunStarted',
}

const testEvents: any = {};

async function saveTestExecutionMetaData(args: Request) {
  const metaData = args.body;
  log.info(`handling test execution event - ${metaData.event_type}`);
  switch (metaData.event_type) {
    case TestEvent.TestRunStarted:
      testEvents[metaData.test_run.integrations.unknown_grid.session_id] = metaData.test_run.uuid;
      await createTestEventInDB(metaData);
      break;

    case TestEvent.TestRunFinished:
      removeEventIdFromCache(testEvents, metaData.test_run.uuid);
      await updateTestEventInDB(metaData);
      break;

    case TestEvent.HookRunStarted:
      testEvents[metaData.hook_run.integrations.unknown_grid.session_id] = metaData.hook_run.uuid;
      await createHookEventInDB(metaData);
      break;

    case TestEvent.HookRunFinished:
      removeEventIdFromCache(testEvents, metaData.hook_run.uuid);
      await updateHookEventInDB(metaData);
      break;
  }
}

async function fetchTestExecution(buildId: string) {
  const data = await getBuildData(buildId);
  const testStructure: Record<string, any>[] = [];
  Object.keys(data).forEach((k) => {
    const test = data[k];
    const scopes = JSON.parse(test.scopes);
    let root: any = testStructure;
    scopes.forEach((scope: string, index: Number) => {
      const parent = root.find((x: any) => x.name === scope);
      if (!parent) {
        let group = {
          name: scope,
          file: test.file,
          buildId: test.id,
          tests: [],
          sub: [],
        };
        root.push(group);
      }
      if (index === scopes.length - 1) {
        const tests = root.find((x: any) => x.name === scope).tests;
        const testEvent = {
          name: test.name,
          result: test.result,
          eventId: test.event_uuid,
          startedAt: test.started_at,
          finishedAt: test.finished_at,
          sessionId: test.session_id,
        };
        tests.push(testEvent);
      }
      root = root.find((x: any) => x.name === scope).sub;
    });
  });
  return testStructure;
}

async function getEventId(sessionId: string) {
  console.log(JSON.stringify(testEvents), sessionId);
  return testEvents[sessionId] as string;
}

function removeEventIdFromCache(obj: any, valueToRemove: string) {
  const keys = Object.keys(obj);
  const foundKey = keys.find((key) => obj[key] === valueToRemove);
  if (foundKey) {
    delete obj[foundKey];
  }
  return obj;
}
export { saveTestExecutionMetaData, fetchTestExecution, getEventId };
