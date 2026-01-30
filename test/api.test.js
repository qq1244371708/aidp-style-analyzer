const path = require('path');
const { Analyzer } = require('../src/index');

describe('Analyzer', () => {
  const fixtureDir = path.resolve(__dirname, 'fixtures/basic');

  test('detects undefined classes', async () => {
    const analyzer = new Analyzer(fixtureDir);
    const issues = await analyzer.run();
    
    const undefinedIssues = issues.filter(i => i.type === 'undefined');
    // "bar" is in HTML but not in CSS -> Undefined
    expect(undefinedIssues.find(i => i.className === 'bar')).toBeTruthy();
    
    // "foo" is in HTML and CSS -> Defined
    expect(undefinedIssues.find(i => i.className === 'foo')).toBeFalsy();
  });
});
