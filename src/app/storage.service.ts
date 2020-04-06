import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  constructor() { }

  public set(key: string, value: any) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  public get(key) {
    return JSON.parse(localStorage.getItem(key));
  }
}
