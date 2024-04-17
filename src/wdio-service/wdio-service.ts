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

async function fetchBuildStructure(buildId: string) {
  const data = await getBuildData(buildId);
  const buildStructure: Record<string, any>[] = [];
  Object.keys(data).forEach((k) => {
    const test = data[k];
    const scopes = JSON.parse(test.scopes);
    let root: any = buildStructure;
    scopes.forEach((scope: string, index: Number) => {
      const parent = root.find((x: any) => x.name === scope);
      if (!parent) {
        let group = {
          name: scope,
          eventType: 'DESCRIBE',
          file: test.file,
          buildId: test.id,
          hooksAndTests: [],
          children: [],
        };
        root.push(group);
      }
      if (index === scopes.length - 1) {
        const events = root.find((x: any) => x.name === scope).hooksAndTests;
        const event = {
          name: test.name,
          result: test.result,
          eventId: test.event_uuid,
          eventType: test.event_sub_type,
          startedAt: test.started_at,
          finishedAt: test.finished_at,
          sessionId: test.session_id,
        };
        events.push(event);
      }
      root = root.find((x: any) => x.name === scope).children;
    });
  });
  return buildStructure;
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
export { saveTestExecutionMetaData, fetchBuildStructure, getEventId };
