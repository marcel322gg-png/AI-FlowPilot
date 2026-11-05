import {describe,it,expect} from 'vitest';
import {applyPreferences,defaultPreferences,readPreferences,savePreferences} from './settings';

describe('display preferences',()=>{
  it('uses safe defaults for new and invalid stored preferences',()=>{
    const storage={getItem:()=>'{bad json'};
    expect(readPreferences(storage)).toEqual(defaultPreferences);
    expect(readPreferences({getItem:()=>JSON.stringify({theme:'unsafe',dashboardRange:13,confirmDelete:false})})).toEqual({...defaultPreferences,confirmDelete:false});
  });
  it('persists selections and applies them as root display attributes',()=>{
    let saved='';const storage={getItem:()=>saved,setItem:(_key:string,value:string)=>{saved=value}};
    const preferences={...defaultPreferences,theme:'dark' as const,accent:'rose' as const,chartPalette:'monochrome' as const,tableDensity:'compact' as const,dashboardRange:7 as const,reducedMotion:true,reducedAnimations:false,highContrast:true,visibleFocus:false,confirmDelete:false};
    savePreferences(storage,preferences);expect(readPreferences(storage)).toEqual(preferences);
    const root={dataset:{} as DOMStringMap} as HTMLElement;applyPreferences(root,preferences);
    expect(root.dataset).toMatchObject({theme:'dark',accent:'rose',chartPalette:'monochrome',tableDensity:'compact',reducedMotion:'true',reducedAnimations:'false',highContrast:'true',visibleFocus:'false'});
  });
});
