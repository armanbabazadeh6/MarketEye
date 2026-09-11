// Quote transport is intentionally independent of physical-world screening.
export class UnavailableMarketDataProvider {
  async getQuote(ticker){return {ticker,status:'unavailable',price:null,asOf:null,reason:'No market pricing provider configured'};}
  async getCompanyProfile(ticker){return {ticker,status:'unavailable',reason:'Use the curated company catalog for supported profiles'};}
}
