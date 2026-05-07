import { toRawString, addRaw, subRaw, compareRaw } from '../../services/numbers';

describe('numbers Service', () => {
    describe('toRawString', () => {
        it('should convert bigint to string', () => {
            expect(toRawString(1000000000000000000n)).toBe('1000000000000000000');
        });

        it('should convert number to string', () => {
            expect(toRawString(42)).toBe('42');
        });

        it('should handle zero', () => {
            expect(toRawString(0n)).toBe('0');
            expect(toRawString(0)).toBe('0');
        });
    });

    describe('addRaw', () => {
        it('should add two raw values', () => {
            expect(addRaw('100', '200')).toBe('300');
        });

        it('should handle very large values (wei-scale)', () => {
            expect(addRaw(
                '1000000000000000000',  // 1 ETH
                '2500000000000000000'   // 2.5 ETH
            )).toBe('3500000000000000000');
        });

        it('should treat empty/null-ish strings as zero', () => {
            expect(addRaw('', '100')).toBe('100');
            expect(addRaw('100', '')).toBe('100');
        });
    });

    describe('subRaw', () => {
        it('should subtract two raw values', () => {
            expect(subRaw('500', '200')).toBe('300');
        });

        it('should clamp to zero if result would be negative', () => {
            expect(subRaw('100', '500')).toBe('0');
        });

        it('should handle equal values', () => {
            expect(subRaw('1000000000000000000', '1000000000000000000')).toBe('0');
        });

        it('should treat empty strings as zero', () => {
            expect(subRaw('', '100')).toBe('0');
            expect(subRaw('100', '')).toBe('100');
        });
    });

    describe('compareRaw', () => {
        it('should return 1 when a > b', () => {
            expect(compareRaw('200', '100')).toBe(1);
        });

        it('should return -1 when a < b', () => {
            expect(compareRaw('100', '200')).toBe(-1);
        });

        it('should return 0 when a === b', () => {
            expect(compareRaw('100', '100')).toBe(0);
        });

        it('should handle large BigInt comparisons correctly', () => {
            expect(compareRaw(
                '99999999999999999999',
                '100000000000000000000'
            )).toBe(-1);
        });

        it('should treat empty strings as zero', () => {
            expect(compareRaw('', '')).toBe(0);
            expect(compareRaw('1', '')).toBe(1);
            expect(compareRaw('', '1')).toBe(-1);
        });
    });
});
