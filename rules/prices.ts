
export const fetchTokenPrices = async (tokenAddresses: string[]) : Promise<{[key:string]:number }> =>  {
// %2C is the url encoding for ','
const tokensCsv = tokenAddresses.join('%2C');
const url = `https://api.coingecko.com/api/v3/simple/token_price/polygon-pos?contract_addresses=${tokensCsv}&vs_currencies=usd`; 
    return fetch(url)
    .then((response) => {
        if (!response.ok) {
            throw new Error(response.statusText)
        }
        return response.json()
                .then(r => {
                    console.log(r);
                    const result:any = {};
                    tokenAddresses.map(address => {
                        const normalizedAddress =address.toLowerCase();
                        if(!r[normalizedAddress]) {
                            result[address] = 0;
                        } else {
                            result[address] = r[normalizedAddress]['usd']
                        }
                    })
                    return result;
                })
    });
}