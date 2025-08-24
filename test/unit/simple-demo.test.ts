import * as assert from 'assert';

describe('Basic Tests', () => {
    
    describe('Math', () => {
        it('should add numbers correctly', () => {
            assert.strictEqual(2 + 2, 4);
        });

        it('should multiply numbers correctly', () => {
            assert.strictEqual(3 * 4, 12);
        });
    });

    describe('Array operations', () => {
        it('should filter arrays correctly', () => {
            const numbers = [1, 2, 3, 4, 5];
            const even = numbers.filter(n => n % 2 === 0);
            assert.deepStrictEqual(even, [2, 4]);
        });

        it('should map arrays correctly', () => {
            const numbers = [1, 2, 3];
            const doubled = numbers.map(n => n * 2);
            assert.deepStrictEqual(doubled, [2, 4, 6]);
        });
    });

    describe('String operations', () => {
        it('should concatenate strings', () => {
            assert.strictEqual('hello' + ' ' + 'world', 'hello world');
        });

        it('should check string includes', () => {
            assert.ok('hello world'.includes('world'));
            assert.ok(!'hello world'.includes('foo'));
        });
    });
});