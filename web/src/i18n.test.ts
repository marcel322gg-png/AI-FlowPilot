import {describe,it,expect} from 'vitest';
import {localeFor,readLanguage,saveLanguage,translate,t} from './i18n';

describe('localization preferences',()=>{
  it('defaults to English and persists the selected language',()=>{
    const values=new Map<string,string>();
    const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}};
    expect(readLanguage(storage)).toBe('en');
    saveLanguage(storage,'uk');
    expect(readLanguage(storage)).toBe('uk');
  });
  it('provides locale and privacy text for each language',()=>{
    expect(localeFor('en')).toBe('en-US');expect(localeFor('uk')).toBe('uk-UA');
    expect(translate('en','privacyTitle')).toBe('Your data stays local');
    expect(translate('uk','privacyTitle')).toBe('Ваші дані залишаються локально');
  });
  it('localizes shared UI text with English fallback and interpolated values',()=>{
    expect(t('uk','System Status')).toBe('Стан системи');
    expect(t('uk','Sales')).toBe('Продажі');
    expect(t('uk','New untranslated key')).toBe('New untranslated key');
    expect(t('uk','Created in the last {days} days',{days:7})).toBe('Створено за останні 7 днів');
  });
});
