// npm install reflect-metadata
import 'reflect-metadata'

const classMetadataKey = Symbol('classMetadata');

// Decoratori di Classe

// Decorator factory per la versione di una classe
function Version(version:string) {
    return function<T extends {new(...args:any[]):{}}>(constructor:T) {
        Reflect.defineMetadata(classMetadataKey, version, constructor);
        return class extends constructor {
            version = version;
        }
    }
}


// Decorator per loggare la creazione di un oggetto
function LogClass(target:Function) {
    console.log(`Creating: ${target.name}`);

    //
    const original = target.prototype.constructor;
    
    target.prototype.constructor = function(...args:any[]) {
        console.log(`Creating: ${target.name}`);
        original.apply(this, args);
    }
}


function Singleton<T extends new (...args: any[]) => any>(target: T) : T {
    let instance: InstanceType<T>;

    // Sostituire il construttore originale con quello nuovo
    const newConstructor = function(...args: any[]) {
        if (!instance) {
            instance = new target(...args);
        }
        return instance;
    } as unknown as T;

    // Copiano il prototype del construttore per mantenere l'ereditaarietà prototipale
    newConstructor.prototype = target.prototype;

    return newConstructor;
}


// Uso combinato dei decorator

@Singleton
@LogClass
@Version('1.0')
class APIService {
    constructor (public url:string) {}

    fetch() {
        console.log(`Fetching data from ${this.url}`);
    }
}

const api1 = new APIService('https://api.com');
const api2 = new APIService('https://api.com');

console.log(api1 === api2);

const classData = Reflect.getMetadata(classMetadataKey, APIService);
console.log("Dati della classe:", classData);



// DECORATORE DI METODI

// Decoratore per misurazione performance
function MeasureTime(
    target: Object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args: any[]) {
      const start = performance.now();
      const result = originalMethod.apply(this, args);
      const end = performance.now();
      console.log(`${String(propertyKey)} execution time: ${end - start} ms`);
      return result;
    };
    
    return descriptor;
  }


  // Decoratore per caching
  function Caching(
    target: Object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cache = new Map<string, any>();
    
    descriptor.value = function(...args: any[]) {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        console.log(`Cache hit for ${String(propertyKey)}`);
        return cache.get(key);
      }
      
      const result = originalMethod.apply(this, args);
      cache.set(key, result);
      return result;
    };
    
    return descriptor;
  }

  // Decoratore pre forzare retry
  function Retry(attempts: number, delay: number = 0) {
    return function(
      target: Object,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function(...args: any[]) {
        let error: Error | null = null;
        
        for (let i = 0; i < attempts; i++) {
          try {
            return await originalMethod.apply(this, args);
          } catch (err) {
            error = err as Error;
            console.log(`Attempt ${i + 1} failed. Retrying...`);
            
            if (delay > 0 && i < attempts - 1) {
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        throw error;
      };
      
      return descriptor;
    };
  }

  class DataProcessor {

    @MeasureTime
    @Caching
    complexCalc(input: number) : number {
        console.log('Processing data...');
        let result = 0;
        for (let count = 0; count < 1000000; count++) {
            result += Math.sin(input * count);
        }
        return result;
    }

    @Retry(3, 1000)
    async fetchData(url: string) : Promise<any> {
        console.log(`Fetching data from ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch data from ${url}`);
        }
        
        return await response.json;
    }

  }
  


  // DECORATORE DI PROPRIETA'

  function Observable(target: Object, propertyKey: string){

    const privateField = `_${propertyKey}`;

    Object.defineProperty(target, propertyKey, {
      get: function() {
        console.log(`Getting ${propertyKey}`);
        return this[privateField];
      },
      set: function(value:any) {
        console.log(`Setting ${propertyKey} to ${value}`);
        const oldValue = this[privateField];
        this[privateField] = value;

        // Emettiamo evento per il change della property
        this.propertyChanged?.(propertyKey, oldValue, value);
      },
      enumerable: true,
      configurable: true
    });

  }

  // Decorator per validazione
  function Validate(validator: (value: any) => boolean, errorMessage: string) {
    return function(target: Object, propertyKey: string) {
      const privateField = `_${propertyKey}`;
      
      Object.defineProperty(target, propertyKey, {
        get() {
          return this[privateField];
        },
        set(value: any) {
          if (!validator(value)) {
            throw new Error(`Validation failed for ${propertyKey}: ${errorMessage}`);
          }
          this[privateField] = value;
        },
        enumerable: true,
        configurable: true,
      });
    };
  }   


  function SerializeJson(target: Object, propertyKey: string) {
    const privateField = `_${propertyKey}`;
    

    Object.defineProperty(target, propertyKey, {
      get() {
        try {
          return JSON.parse(this[privateField] || '{}');
        } catch (error) {
          return {};
        }        
      },
      set(value: any) {
        this[privateField] = JSON.stringify(value);
      },
      enumerable: true,
      configurable: true,
    });
  }


class MyUser {
    propertyChanged?(name: string, oldValue: any, newValue:any): void;

    @Observable
    userName: string = '';

    @Validate(value => typeof value === 'number' && value > 0, 'Age must be greater than 0')
    age: number = 0;

    @SerializeJson
    settings: any = {};

    constructor() {
        this.propertyChanged = (name, oldValue, newValue) => {
            console.log(`Property ${name} changed from ${oldValue} to ${newValue}`);
        };
    }

}



  // DECORATORE DI PARAMETRI

  // Decoratore per convalidare parametri
function ValidateParam(validator: (value: any) => boolean, errorMessage: string) {
    return function(
        target: any,
        propertyKey: string,
        parameterIndex: number
    ) {
        // Recupero del metodo originale
        const originalMethod = target[propertyKey];

        if (typeof originalMethod === 'function') {
            target[propertyKey] = function(...args: any[]) {
                
                const valueToValidate = args[parameterIndex];

                if (!validator(valueToValidate)) {
                    throw new Error(`Parameter ${parameterIndex} validation failed: ${errorMessage}`);
                }
                return originalMethod.apply(this, args);
            };
        }

        return target;
    }
}
  
// Validatore per numeri positivi
function isPositive(value: number): boolean {
    return typeof value === 'number' && value > 0;
}   

function isNotEmptyString(value: string): boolean {
    return typeof value === 'string' && value?.trim().length > 0;
}   

class TestValidators {

    calculateAreaSquare(
        @ValidateParam(isPositive, 'Width must be positive') width: number, 
        @ValidateParam(isPositive, 'Width must be positive') height: number
    ) : number {
        return width * height;
    }

    printName(
        @ValidateParam(isNotEmptyString, 'Name must not be empty') name: string
    ) {
         console.log(name);
    }

}


// Decoratore per iniettare parametri
function Inject(serviceIdentifier: string) {
    return function(target: Object, methodName: string | symbol, parameterIndex: number) {
      // Salviamo i metadati per l'iniezione delle dipendenze
      const existingRequiredParams: Record<number, string> = 
        Reflect.getOwnMetadata('inject:params', target, methodName as string) || {};
      
      existingRequiredParams[parameterIndex] = serviceIdentifier;
      
      Reflect.defineMetadata(
        'inject:params',
        existingRequiredParams,
        target,
        methodName as string
      );
    };
  }

  class UserService {

    processUser(
        @Inject('LoggerService') logger: any,
        user: any
    ) {
        logger.log(user);
        return user; 
    }
  }


const Injectable = (): ClassDecorator => {
    return (target: any) => {
        Reflect.defineMetadata('injectable', true, target);
    }
}

@Injectable()
class LogService {
    log(message: string) {
        console.log(`[LOG] ${message}`);
    }
}

function Autowired(target: Object, propertyKey: string) {
    const type = Reflect.getMetadata('design:type', target, propertyKey);
    
    Reflect.defineMetadata(
        'autowired',
        { propertyKey, type},
        target.constructor
    );
  }

  @Injectable()
  class AuthService {
    @Autowired
    logService!: LogService;

    authenticate(user: string, password: string) {
        this.logService.log(`${user} ${password}`);
    }
  } 

  function Route(path: string) {
    return function(
        target: Object,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        Reflect.defineMetadata(
            'route',
            { path, method: propertyKey },
            target.constructor
        );
    }
  }

  @Injectable()
  class UserController {
    @Autowired
    private authService!: AuthService;

    login(user: string, password: string) {
        return this.authService.authenticate(user, password);
    }
  }


  class DIContainer {
    private static services = new Map<Function, Object>();

    static register<T>(serviceClass: new (...args: any[]) => T) : void {
        if (!Reflect.getMetadata('injectable', serviceClass)) {
            throw new Error('Class is not injectable');
        }

        const instance = new serviceClass();
        
        const autowiredData = Reflect.getMetadata('autowired', serviceClass);
        if (autowiredData) {
            const { propertyKey, type} = autowiredData; //  as { propertyKey: string, type: any };
           
            instance[propertyKey as keyof T] = DIContainer.get(type);
        }
    }

    static get<T>(serviceClass: new (...args: any[] ) => T) : T {
        if (!DIContainer.services.has(serviceClass)) {
            DIContainer.register(serviceClass);
        }
        return DIContainer.services.get(serviceClass) as T;
    }


  }
  



