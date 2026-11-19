import test from 'node:test';
import assert from 'node:assert/strict';
import {handler, ENABLE_POST} from '../src/index.mjs';
const request = (httpMethod, id, body) => handler({httpMethod,pathParameters:{'cliente-id':id},body:body && JSON.stringify(body)});
test('GET cliente conocido responde 200 con datos Lambda', async () => {
  const r = await request('GET','CLI001');
  assert.equal(r.statusCode,200);
  assert.equal(JSON.parse(r.body).origen,'LAMBDA');
});
test('GET inexistente responde 404', async () => assert.equal((await request('GET','CLI999')).statusCode,404));
test('identificador inválido responde 400', async () => assert.equal((await request('GET','abc')).statusCode,400));
test('POST habilitado valida campos y devuelve 201', {skip:!ENABLE_POST}, async () => {
  assert.equal((await request('POST','CLI001',{tipo:'AHORROS',moneda:'PEN',titular:'Persona'})).statusCode,201);
  assert.equal((await request('POST','CLI001',{tipo:'INVALIDO',moneda:'PEN',titular:'Persona'})).statusCode,400);
});

test('POST está habilitado para el laboratorio propuesto', () => assert.equal(ENABLE_POST, true));

test('POST devuelve los datos solicitados y no modifica GET', async () => {
  const before = JSON.parse((await request('GET', 'CLI001')).body);
  const data = {tipo:'CORRIENTE', moneda:'USD', titular:'Cliente Demo 16'};
  const response = await request('POST', 'CLI001', data);
  assert.equal(response.statusCode, 201);
  assert.equal(response.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(response.body), {
    numeroCuenta:'SIMULADO-0001', ...data, saldo:0, nota:'Simulación sin persistencia'
  });
  assert.deepEqual(JSON.parse((await request('GET', 'CLI001')).body), before);
});

for (const [label, body] of [
  ['tipo inválido', {tipo:'INVALIDO', moneda:'PEN', titular:'Demo'}],
  ['moneda inválida', {tipo:'AHORROS', moneda:'EUR', titular:'Demo'}],
  ['titular vacío', {tipo:'AHORROS', moneda:'PEN', titular:''}],
  ['titular en blanco', {tipo:'AHORROS', moneda:'PEN', titular:'   '}],
  ['titular numérico', {tipo:'AHORROS', moneda:'PEN', titular:16}],
  ['campos ausentes', {}],
  ['JSON null', null],
  ['array', []],
  ['cadena JSON', 'texto'],
  ['número JSON', 16],
]) {
  test(`POST rechaza ${label} con 400`, async () => {
    const r = await handler({httpMethod:'POST', pathParameters:{'cliente-id':'CLI001'}, body:JSON.stringify(body)});
    assert.equal(r.statusCode, 400);
    const problem = JSON.parse(r.body);
    assert.equal(problem.status, 400);
    assert.ok(problem.title && problem.detail);
  });
}

test('POST rechaza JSON malformado con 400', async () => {
  const r = await handler({httpMethod:'POST', pathParameters:{'cliente-id':'CLI001'}, body:'{'});
  assert.equal(r.statusCode, 400);
  assert.equal(JSON.parse(r.body).title, 'JSON inválido');
});
test('POST sin cuerpo responde 400', async () => assert.equal((await request('POST','CLI001')).statusCode,400));
test('POST con cliente inexistente responde 404', async () => assert.equal((await request('POST','CLI999',{tipo:'AHORROS',moneda:'PEN',titular:'Demo'})).statusCode,404));
test('POST con identificador inválido responde 400', async () => assert.equal((await request('POST','abc',{tipo:'AHORROS',moneda:'PEN',titular:'Demo'})).statusCode,400));
test('Método no habilitado responde 405', async () => assert.equal((await request('DELETE','CLI001')).statusCode,405));
