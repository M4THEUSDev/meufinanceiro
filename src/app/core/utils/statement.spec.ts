import { guessCategory, isLikelyTransfer, parseAmount, parseDate, parseStatement } from './statement';

const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><SIGNONMSGSRSV1><SONRS><FI><ORG>Itau</ORG></FI></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>0341<ACCTID>12345-6</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105120000[-3:BRT]<TRNAMT>-23.40<FITID>A1<MEMO>UBER *TRIP</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261105<TRNAMT>8650.00<FITID>A2<MEMO>SALARIO ACME LTDA</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('statement import', () => {
  it('lê OFX do Itaú', () => {
    const p = parseStatement(OFX, 'extrato.ofx');
    expect(p.format).toBe('ofx');
    expect(p.bankName).toBe('Itaú');
    expect(p.lines.length).toBe(2);
    expect(p.lines[0].amount).toBe(-23.4);
    expect(p.lines[0].description).toBe('UBER *TRIP');
    expect(new Date(p.lines[0].date).getDate()).toBe(5);
  });

  it('lê CSV da conta Nubank', () => {
    const csv = 'Data,Valor,Identificador,Descrição\n05/11/2026,-58.90,abc-1,Compra no débito - iFood\n04/11/2026,1200.00,abc-2,Transferência recebida pelo Pix - Cliente';
    const p = parseStatement(csv, 'NU_2026.csv');
    expect(p.format).toBe('nubank-conta');
    expect(p.isCard).toBeFalse();
    expect(p.lines.map((l) => l.amount)).toEqual([-58.9, 1200]);
    expect(p.lines[0].importId).toBe('nuconta:abc-1');
  });

  it('lê CSV do cartão Nubank (compra positiva vira saída)', () => {
    const csv = 'date,title,amount\n2026-11-05,Netflix.Com,44.90\n2026-11-06,Pagamento recebido,-500.00';
    const p = parseStatement(csv);
    expect(p.format).toBe('nubank-cartao');
    expect(p.isCard).toBeTrue();
    expect(p.lines[0].amount).toBe(-44.9);
    expect(isLikelyTransfer(p.lines[1].description)).toBeTrue();
  });

  it('interpreta valores e datas brasileiros', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('-23.40')).toBe(-23.4);
    expect(parseAmount('(5,00)')).toBe(-5);
    expect(new Date(parseDate('26/11/2026')!).getMonth()).toBe(10);
  });

  it('categoriza por palavras-chave e pelo histórico', () => {
    const valid = new Set(['c_transporte', 'c_alimentacao', 'c_salario', 'c_pets']);
    expect(guessCategory('UBER *TRIP', -23.4, valid, new Map())).toBe('c_transporte');
    expect(guessCategory('SALARIO ACME', 8650, valid, new Map())).toBe('c_salario');
    expect(guessCategory('Loja do Zé', -10, valid, new Map([['e:loja', 'c_pets']]))).toBe('c_pets');
  });
});

describe('tidyDescription', () => {
  it('remove prefixos do Nubank', async () => {
    const { tidyDescription } = await import('./statement');
    expect(tidyDescription('Compra no débito - Padaria Real')).toBe('Padaria Real');
    expect(tidyDescription('Transferência recebida pelo Pix - JOAO')).toBe('Transferência recebida pelo Pix - JOAO');
  });
});
