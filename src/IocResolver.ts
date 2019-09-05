/*
* @poppinss/utils
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import { IocContract } from '@adonisjs/fold'
import { Exception } from './Exception'

/**
 * Exposes the API to resolve and call bindings from the IoC container. The resolver
 * internally caches the IoC container lookup nodes to boost performance.
 */
export class IoCResolver {
  private _lookupCache: { [key: string]: {
    namespace: string,
    type: 'binding' | 'autoload',
    method: string,
  } } = {}

  constructor (
    private _container: IocContract,
    private _rcNamespaceKey?: string,
    private _fallbackNamespace?: string,
  ) {}

  /**
   * Returns the prefix namespace by giving preference to the
   * `.adonisrc.json` file
   */
  private _getPrefixNamespace (): string | undefined {
    if (!this._rcNamespaceKey) {
      return this._fallbackNamespace
    }

    try {
      const application = this._container.use('Adonis/Core/Application')
      return application.namespacesMap.get(this._rcNamespaceKey) || this._fallbackNamespace
    } catch (error) {
      return this._fallbackNamespace
    }
  }

  /**
   * Resolves the namespace and returns it's lookup node
   */
  public resolve (namespace: string) {
    /**
     * Return from cache, when the node exists
     */
    const cacheNode = this._lookupCache[namespace]
    if (cacheNode) {
      return cacheNode
    }

    let method = 'handle'

    /**
     * Split the namespace to lookup the method on it. If method isn't
     * defined, we will use the conventional `handle` method.
     */
    const tokens = namespace.split('.')
    if (tokens.length > 1) {
      method = tokens.pop()!
    }

    const lookupNode = this._container.lookup(tokens.join('.'), this._getPrefixNamespace())

    /**
     * Raise exception when unable to resolve the binding from the container.
     * NOTE: We are not making fetching the binding, we are just checking
     * for it's existence. In case of autoloads, it's quite possible
     * that the binding check passes and the actual file is missing
     * on the disk
     */
    if (!lookupNode) {
      throw new Exception(`Unable to resolve ${tokens.join('.')} namespace from IoC container`)
    }

    this._lookupCache[namespace] = { ...lookupNode, method }
    return this._lookupCache[namespace]
  }

  /**
   * Calls the namespace.method expression with any arguments that needs to
   * be passed. Also supports type-hinting dependencies.
   */
  public call<T extends any> (namespace: string, args: any[]): T {
    const lookupNode = this.resolve(namespace)
    return this._container.call(this._container.make(lookupNode.namespace), lookupNode.method, args)
  }
}